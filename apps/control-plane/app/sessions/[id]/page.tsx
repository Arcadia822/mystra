import { EmptyState } from "../../_components/states";

export default function SessionDetailPage() {
  return <div className="pageContent"><EmptyState title="Session detail is temporarily unavailable" description="Session persistence and execution APIs are outside the active Prisma schema." /></div>;
}
