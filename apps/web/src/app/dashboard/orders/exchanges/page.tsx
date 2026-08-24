import { ReturnsPage } from "../../../../modules/returns/components/returns-page";

type ExchangesRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ExchangesRoutePage({ searchParams }: ExchangesRoutePageProps) {
  return <ReturnsPage searchParams={searchParams} type="EXCHANGE" />;
}
