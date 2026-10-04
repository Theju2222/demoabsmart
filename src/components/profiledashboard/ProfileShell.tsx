"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import ProfileSidebar from "./ProfileSidebar";
import AuthGate from "@/components/auth/AuthGate";
import { setCurrentUser } from "@/redux/slices/userSlice";
import * as api from "@/api/apiRoutes";

// Persistent shell for every /profile route, mounted from profile/layout.tsx.
//
// This used to live in ProfileDashboard, which each route rendered itself —
// so a tab switch (a real route navigation) unmounted and remounted the whole
// thing: the sidebar disappeared, getUser refetched, and its `loading` flag
// blanked the content area behind a skeleton. From a layout, React keeps this
// subtree mounted across navigations and swaps only `children`, so the sidebar
// and the user fetch survive a tab change.
const ProfileShellInner = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const city = useSelector((state: any) => state.City.city);
  const [selectedTab, setSelectedTab] = useState("profile");

  useEffect(() => {
    const currentTab = (pathname || "").split("/").pop();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected tab from route pathname
    setSelectedTab(currentTab || "profile");
  }, [pathname]);

  const getCurrentUser = useCallback(async () => {
    try {
      const response = await api.getUser({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      dispatch(setCurrentUser({ data: response.data }));
    } catch (error) {
      console.log("error", error);
    }
  }, [city, dispatch]);

  // StrictMode's dev-only double-invoke of this mount effect would otherwise
  // fire getCurrentUser twice. A ref (not state) so the write is synchronous
  // and visible across the phantom mount→cleanup→remount cycle.
  const fetchedUserRef = useRef(false);

  useEffect(() => {
    if (fetchedUserRef.current) return;
    fetchedUserRef.current = true;
    getCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <BreadCrumb />
      <div className="container">
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6 mb-5 md:mb-10 mt-2 md:mt-4">
          <div className="hidden md:block w-[230px] lg:w-[300px] xl:w-[340px] shrink-0">
            <ProfileSidebar
              setSelectedTab={setSelectedTab}
              selectedTab={selectedTab}
            />
          </div>

          {/* No loading gate around children: the user fetch above only feeds
              the sidebar/profile header, and blocking the whole content area
              on it was what made every tab switch flash a full-height
              skeleton. Each tab renders its own loading state instead. */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </section>
  );
};

const ProfileShell = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <AuthGate requireAuth>
    <ProfileShellInner>{children}</ProfileShellInner>
  </AuthGate>
);

export default ProfileShell;
