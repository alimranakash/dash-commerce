import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  docsPages,
  docsSections,
  getDocsPage,
  getDocsPageNeighbors
} from "../../../modules/docs/docs-content";
import styles from "./docs.module.css";

type DocsPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export function generateStaticParams() {
  return [
    {},
    ...docsPages.map((page) => ({
      slug: page.slug.split("/")
    }))
  ];
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = getDocsPage(slug?.join("/"));

  return {
    description: page?.intro ?? "Dash Commerce OS বিক্রেতাদের জন্য সহায়িকা।",
    title: page ? `${page.title} | Dash Docs` : "Dash Commerce OS Docs"
  };
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = getDocsPage(slug?.join("/"));

  if (!page) {
    notFound();
  }

  const neighbors = getDocsPageNeighbors(page.slug);

  return (
    <main className={styles.docsPage}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/">
          <span>D</span>
          Dash Commerce OS
        </Link>
        <nav aria-label="Docs header navigation">
          <Link href="/">হোম</Link>
          <Link href="/login">লগইন</Link>
          <Link className={styles.startButton} href="/register">শুরু করুন</Link>
        </nav>
      </header>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <DocsNav activeSlug={page.slug} />
        </aside>

        <details className={styles.mobileNav}>
          <summary><BookOpen /> ডকুমেন্টেশন দেখুন</summary>
          <DocsNav activeSlug={page.slug} />
        </details>

        <article className={styles.article}>
          <div className={styles.searchBox}>
            <Search />
            <span>ডকুমেন্টেশন খুঁজুন</span>
          </div>

          <div className={styles.breadcrumb}>
            <Link href="/docs">ডকস</Link>
            <ChevronRight />
            <span>{page.category}</span>
            <ChevronRight />
            <strong>{page.title}</strong>
          </div>

          <header className={styles.hero}>
            <p>{page.category}</p>
            <h1>{page.title}</h1>
            <span>{page.intro}</span>
          </header>

          <DocSection title="পরিচিতি">
            <p>{page.intro}</p>
          </DocSection>

          <DocSection title="এটি কী কাজে ব্যবহার হয়">
            <ul className={styles.tips}>
              {page.useCase.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </DocSection>

          <DocSection title="কীভাবে ব্যবহার করবেন">
            <ol className={styles.steps}>
              {page.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </DocSection>

          <DocSection title="গুরুত্বপূর্ণ তথ্য">
            <ul className={styles.tips}>
              {page.important.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </DocSection>

          <DocSection title="টিপস">
            <ul className={styles.tips}>
              {page.tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </DocSection>

          <DocSection title="সাধারণ ভুল">
            <ul className={styles.tips}>
              {page.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
            </ul>
          </DocSection>

          <DocSection title="Related Pages">
            <div className={styles.relatedGrid}>
              {(page.related ?? []).map((title) => {
                const related = docsPages.find((candidate) => candidate.title === title);

                return related ? (
                  <Link href={`/docs/${related.slug}`} key={related.slug}>
                    <span>{related.category}</span>
                    <strong>{related.title}</strong>
                  </Link>
                ) : null;
              })}
            </div>
          </DocSection>

          <nav className={styles.pager} aria-label="Documentation pagination">
            {neighbors.previous ? (
              <Link href={`/docs/${neighbors.previous.slug}`}>
                <ArrowLeft />
                <span>আগের পেজ</span>
                <strong>{neighbors.previous.title}</strong>
              </Link>
            ) : <span />}
            {neighbors.next ? (
              <Link href={`/docs/${neighbors.next.slug}`}>
                <span>পরের পেজ</span>
                <strong>{neighbors.next.title}</strong>
                <ArrowRight />
              </Link>
            ) : <span />}
          </nav>
        </article>
      </div>
    </main>
  );
}

function DocsNav({ activeSlug }: { activeSlug: string }) {
  return (
    <nav className={styles.docsNav} aria-label="Documentation sections">
      <div className={styles.sidebarIntro}>
        <BookOpen />
        <div>
          <strong>বিক্রেতা ডকস</strong>
          <span>Dash Commerce OS ব্যবহার গাইড</span>
        </div>
      </div>
      {docsSections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.pages.map((page) => (
            <Link
              aria-current={page.slug === activeSlug ? "page" : undefined}
              className={page.slug === activeSlug ? styles.activeLink : ""}
              href={`/docs/${page.slug}`}
              key={page.slug}
            >
              {page.title}
            </Link>
          ))}
        </section>
      ))}
    </nav>
  );
}

function DocSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.docSection}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
