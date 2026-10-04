import React from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import { useSelector } from "react-redux";
import { sanitizeHtml } from "@/utils/sanitizeHtml";

const AboutUs = () => {
  const setting = useSelector((state: any) => state?.Setting?.setting);
  return (
    <section>
      <div>
        <div>
          <BreadCrumb />
        </div>
        {setting?.about_us !== "" && (
          <div
            className="infoContent"
            dangerouslySetInnerHTML={sanitizeHtml(setting?.about_us)}
          />
        )}
      </div>
    </section>
  );
};

export default AboutUs;
