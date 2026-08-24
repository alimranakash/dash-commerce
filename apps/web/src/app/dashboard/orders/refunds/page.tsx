import { ReturnsPage } from "../../../../modules/returns/components/returns-page";

type RefundsRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function RefundsRoutePage({ searchParams }: RefundsRoutePageProps) {
  return <ReturnsPage searchParams={searchParams} type="REFUND" />;
}
