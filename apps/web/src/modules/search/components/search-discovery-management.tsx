import { Trash2 } from "lucide-react";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import {
  createSearchBoostFormAction,
  createSearchRedirectFormAction,
  createSynonymGroupFormAction,
  deleteSearchBoostFormAction,
  deleteSearchRedirectFormAction,
  deleteSynonymGroupFormAction
} from "../search-admin.actions";
import type { getSearchDiscoveryOverview } from "../search-admin.service";

type SearchDiscoveryManagementProps = {
  boostableProducts: Array<{ id: string; title: string }>;
  error?: string | null;
  message?: string | null;
  overview: Awaited<ReturnType<typeof getSearchDiscoveryOverview>>;
  storeSlug: string;
};

export function SearchDiscoveryManagement({
  boostableProducts,
  error,
  message,
  overview,
  storeSlug
}: SearchDiscoveryManagementProps) {
  const { analytics, boosts, redirects, synonymGroups } = overview;

  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="catalog-page-heading">
          <h1>Search &amp; Discovery</h1>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <div className="catalog-management-grid">
          <section className="catalog-card catalog-list-card">
            <header>
              <h2>Synonyms</h2>
            </header>
            <p className="catalog-card-subtitle">
              Terms in a group all mean the same thing, in both directions. Useful when shoppers and
              your product titles use different words — or different scripts, like
              <strong> jama, জামা, dress</strong>.
            </p>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th>Terms</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {synonymGroups.length ? (
                    synonymGroups.map((group) => (
                      <tr key={group.id}>
                        <td>{group.terms.join(", ")}</td>
                        <td>
                          <div className="catalog-row-actions">
                            <DeleteConfirmationButton
                              action={deleteSynonymGroupFormAction.bind(null, group.id)}
                              ariaLabel={`Delete synonym group ${group.terms.join(", ")}`}
                              title="Delete synonym group"
                            >
                              <Trash2 />
                            </DeleteConfirmationButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="catalog-empty-row" colSpan={2}>
                        No synonym groups yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="catalog-form-body">
              <form
                action={createSynonymGroupFormAction}
                className="resource-form compact-form catalog-create-form"
              >
                <label>
                  Comma-separated terms
                  <input name="terms" placeholder="jama, জামা, dress" required type="text" />
                </label>
                <div className="form-actions">
                  <button className="catalog-submit-button" type="submit">
                    Add group
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="catalog-card catalog-list-card">
            <header>
              <h2>Pinned products</h2>
            </header>
            <p className="catalog-card-subtitle">
              Force a product to the top for one exact search term. It shows even if it would not
              have matched on its own.
            </p>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th>Search term</th>
                    <th>Product</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {boosts.length ? (
                    boosts.map((boost) => (
                      <tr key={boost.id}>
                        <td>{boost.query}</td>
                        <td>{boost.product.title}</td>
                        <td>
                          <div className="catalog-row-actions">
                            <DeleteConfirmationButton
                              action={deleteSearchBoostFormAction.bind(null, boost.id)}
                              ariaLabel={`Unpin ${boost.product.title} from ${boost.query}`}
                              title="Remove pin"
                            >
                              <Trash2 />
                            </DeleteConfirmationButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="catalog-empty-row" colSpan={3}>
                        No pinned products yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="catalog-form-body">
              <form
                action={createSearchBoostFormAction}
                className="resource-form compact-form catalog-create-form"
              >
                <label>
                  Search term
                  <input name="query" placeholder="eid dress" required type="text" />
                </label>
                <label>
                  Product
                  <select name="productId" required>
                    <option value="">Select a product</option>
                    {boostableProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-actions">
                  <button className="catalog-submit-button" type="submit">
                    Pin product
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="catalog-card catalog-list-card">
            <header>
              <h2>Redirects</h2>
            </header>
            <p className="catalog-card-subtitle">
              Send a search straight to a page instead of a product grid — the usual case is
              questions like <strong>delivery</strong> or <strong>return policy</strong>.
            </p>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th>Search term</th>
                    <th>Goes to</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {redirects.length ? (
                    redirects.map((rule) => (
                      <tr key={rule.id}>
                        <td>{rule.query}</td>
                        <td>{rule.targetUrl}</td>
                        <td>
                          <div className="catalog-row-actions">
                            <DeleteConfirmationButton
                              action={deleteSearchRedirectFormAction.bind(null, rule.id)}
                              ariaLabel={`Delete redirect for ${rule.query}`}
                              title="Delete redirect"
                            >
                              <Trash2 />
                            </DeleteConfirmationButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="catalog-empty-row" colSpan={3}>
                        No redirects yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="catalog-form-body">
              <form
                action={createSearchRedirectFormAction}
                className="resource-form compact-form catalog-create-form"
              >
                <label>
                  Search term
                  <input name="query" placeholder="delivery" required type="text" />
                </label>
                <label>
                  Destination
                  <input name="targetUrl" placeholder="/pages/shipping" required type="text" />
                </label>
                <div className="form-actions">
                  <button className="catalog-submit-button" type="submit">
                    Save redirect
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="catalog-card catalog-list-card">
            <header>
              <h2>What shoppers search for</h2>
            </header>
            <p className="catalog-card-subtitle">
              Counted once per search on the results page. The empty-handed list is the one worth
              acting on — each row is a shopper who found nothing.
            </p>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th>Top searches</th>
                    <th>Times</th>
                    <th>Last results</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topQueries.length ? (
                    analytics.topQueries.map((stat) => (
                      <tr key={stat.id}>
                        <td>{stat.query}</td>
                        <td>{stat.searchCount}</td>
                        <td>{stat.lastResultCount}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="catalog-empty-row" colSpan={3}>
                        No searches recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="catalog-table-wrap">
              <table className="catalog-management-table">
                <thead>
                  <tr>
                    <th>Came back empty</th>
                    <th>Times</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.zeroResultQueries.length ? (
                    analytics.zeroResultQueries.map((stat) => (
                      <tr key={stat.id}>
                        <td>{stat.query}</td>
                        <td>{stat.searchCount}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="catalog-empty-row" colSpan={2}>
                        Every search so far returned something.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
