/** @deprecated Phase 6 — {@link ./PublicationSharedPresence.tsx} */
import type { ComponentProps } from "react";
import { PublicationSharedPresence } from "./PublicationSharedPresence";

type PublicationSharedPresenceProps = ComponentProps<typeof PublicationSharedPresence>;

export function CourseSharedPresence({
  courseId,
  ...rest
}: Omit<PublicationSharedPresenceProps, "publicationId"> & { courseId: string }) {
  return <PublicationSharedPresence publicationId={courseId} {...rest} />;
}
