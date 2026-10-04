import ProfileShell from "@/components/profiledashboard/ProfileShell";

// Holds the sidebar + user fetch for every /profile route. Because it's a
// layout, React keeps it mounted across tab navigations and swaps only the
// page below it — previously each route rendered the shell itself, so every
// tab click remounted the sidebar and refetched the user.
export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProfileShell>{children}</ProfileShell>;
}
