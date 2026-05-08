import Link from "next/link";

type MembershipLinkProps = {
  providerId: string;
};

export function MembershipLink({ providerId }: MembershipLinkProps) {
  return (
    <Link
      className="inline-flex items-center rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
      href={`/providers/${providerId}/membership`}
    >
      Membership
    </Link>
  );
}
