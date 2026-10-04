import BlogSkeleton from "@/components/blogs/BlogsSkeleton";

// Same skeleton Blogs shows while its own data loads, so the route-level
// placeholder hands off without swapping to a different layout mid-load.
export default function Loading() {
  return <BlogSkeleton />;
}
