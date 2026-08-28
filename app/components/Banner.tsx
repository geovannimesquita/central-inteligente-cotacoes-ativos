/**
 * Banner de aviso, informacao ou erro.
 *
 * Cada variante tem glifo textual proprio ("!", "i", "x") para que o significado
 * nao dependa apenas da cor, atendendo ao requisito de acessibilidade.
 */

export type BannerTone = "warning" | "info" | "error";

const GLYPHS: Record<BannerTone, string> = {
  warning: "!",
  info: "i",
  error: "x",
};

const ROLE: Record<BannerTone, "status" | "alert"> = {
  warning: "status",
  info: "status",
  error: "alert",
};

interface BannerProps {
  tone: BannerTone;
  title?: string;
  children: React.ReactNode;
}

export default function Banner({ tone, title, children }: BannerProps) {
  return (
    <div className={`banner banner--${tone}`} role={ROLE[tone]}>
      <span className="banner__glyph" aria-hidden="true">
        {GLYPHS[tone]}
      </span>
      <div>
        {title ? <strong className="banner__title">{title}</strong> : null}
        <span>{children}</span>
      </div>
    </div>
  );
}
