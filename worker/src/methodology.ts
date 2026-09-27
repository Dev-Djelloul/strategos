/** Page "Sources et méthodologie", générée depuis sourcesInfo.ts. */
import type { Env } from "./types.ts";
import { BASEMAP_CREDITS, CONFLICT_SOURCES, CONTROL_SOURCES, LAYER_SOURCES, NOT_INTEGRATED_SOURCES, isConfigured } from "./sourcesInfo.ts";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderMethodology(env: Env): string {
  const cards = CONFLICT_SOURCES.map((s) => {
    const rel =
      s.reliability === "verified"
        ? `<span class="sp-rel rel-verified">Source qualifiée</span>`
        : `<span class="sp-rel rel-press">Presse — non vérifié</span>`;
    const conf = s.secrets.length
      ? isConfigured(env, s)
        ? `<span class="doc-ok">identifiants présents</span>`
        : `<span class="doc-ko">identifiants absents — source inactive</span>`
      : `<span class="doc-ok">aucune configuration nécessaire</span>`;
    return `
        <article class="doc-card">
          <div class="doc-card-head"><h3>${esc(s.name)}</h3>${rel}</div>
          <p class="doc-muted">${esc(s.full)}</p>
          <dl class="doc-dl">
            <dt>Nature</dt><dd>${esc(s.kind)}</dd>
            <dt>Fraîcheur</dt><dd>${esc(s.freshness)}</dd>
            <dt>Couverture</dt><dd>${esc(s.coverage)}</dd>
            <dt>Accès</dt><dd>${esc(s.access)}</dd>
            <dt>Licence</dt><dd>${esc(s.license)}</dd>
            <dt>Configuration ici</dt><dd>${conf}</dd>
          </dl>
          <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)} ↗</a>
        </article>`;
  }).join("");

  const layers = [...LAYER_SOURCES, ...CONTROL_SOURCES].map(
    (l) => `<tr><td>${esc(l.name)}</td><td><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.provider)}</a></td><td>${esc(l.freshness)}</td><td>${esc(l.license)}</td><td>${esc(l.note)}</td></tr>`,
  ).join("");
  const credits = BASEMAP_CREDITS.map(([what, who]) => `<li><strong>${esc(what)}</strong> — ${esc(who)}</li>`).join("");
  const notIntegrated = NOT_INTEGRATED_SOURCES.map(
    (s) => `<li><strong><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></strong> — ${esc(s.reason)}</li>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sources et méthodologie — Strategos</title>
  <link rel="icon" href="/static/logo-mark.png" type="image/png" />
  <link rel="apple-touch-icon" href="/static/logo-mark.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&family=JetBrains+Mono:wght@500&display=swap" />
  <link rel="stylesheet" href="/static/style.css" />
</head>
<body class="doc">
  <header class="topbar">
    <div class="brand">
      <img class="brand-mark" src="/static/logo-mark.png" alt="" width="28" height="28" />
      <div>
        <h1>Strategos</h1>
        <p class="subtitle">Sources et méthodologie</p>
      </div>
    </div>
    <a class="btn-secondary link-btn" href="/">← Retour au globe</a>
  </header>

  <main class="doc-main">
    <section>
      <h2>Principe</h2>
      <p>Strategos n'affiche que des <strong>données réelles</strong> issues de sources publiques identifiées. Aucune donnée n'est simulée ou complétée : si une source est indisponible, la couche l'indique. Chaque événement est présenté avec son niveau de fiabilité, pour distinguer ce qui a été qualifié par des analystes de ce qui est seulement détecté dans la presse.</p>
      <p class="doc-warn">Cet outil est pédagogique et informatif. Il ne doit pas servir à des décisions opérationnelles ou de sécurité : l'absence d'événement sur le globe ne signifie pas l'absence de violence.</p>
    </section>

    <section>
      <h2>Sources de conflits</h2>
      <div class="doc-cards">${cards}
      </div>
    </section>

    <section>
      <h2>Fusion et niveaux de fiabilité</h2>
      <p>Un même événement est souvent rapporté par plusieurs sources. Les points situés à <strong>moins de 30 km</strong> et à <strong>moins de 3 jours</strong> d'écart sont regroupés en un seul marqueur ; le titre et le type viennent de la source la plus fiable, la date affichée est la plus récente.</p>
      <table class="doc-table">
        <thead><tr><th>Niveau</th><th>Condition</th><th>Sur le globe</th></tr></thead>
        <tbody>
          <tr><td><span class="sp-rel rel-verified">Confirmé</span></td><td>Au moins 2 sources distinctes, dont une qualifiée (ACLED ou UCDP)</td><td>Grand point cerclé de vert</td></tr>
          <tr><td><span class="sp-rel rel-verified">Qualifié</span></td><td>Une source qualifiée seule</td><td>Point normal</td></tr>
          <tr><td><span class="sp-rel rel-press">Presse seule</span></td><td>Détecté uniquement dans la presse (GDELT), non vérifié</td><td>Petit point semi-transparent, masquable</td></tr>
        </tbody>
      </table>
      <p>Les <strong>victimes</strong> ne proviennent que de sources qualifiées : GDELT n'en fournit pas.</p>
      <h3>Lecture du globe</h3>
      <p>De loin, les événements sont regroupés en <strong>colonnes hexagonales</strong> (grille H3) : la <strong>hauteur et la couleur</strong> indiquent l'intensité, calculée en pondérant chaque événement par ses victimes déclarées (plafonnées à 50) ; un événement « presse seule » compte moitié. En zoomant, les hexagones laissent place à des <strong>marqueurs lumineux</strong> individuels (taille selon les victimes, anneau vert pour un événement confirmé, halo pulsant pour les 3 derniers jours). Le panneau « Dans la vue » résume les événements de la zone visible.</p>
      <h3>Couleurs des événements</h3>
      <p class="doc-legend">
        <span><i style="background:#e05a56"></i> Frappes aériennes / tirs à distance</span>
        <span><i style="background:#c9302c"></i> Batailles / offensives</span>
        <span><i style="background:#8b1a1a"></i> Violence contre civils</span>
        <span><i style="background:#e0a13c"></i> Manifestations</span>
        <span><i style="background:#4caf7d"></i> Développements stratégiques</span>
      </p>
    </section>

    <section>
      <h2>Traitement de GDELT</h2>
      <p>GDELT n'est pas une base vérifiée : ses événements sont extraits automatiquement d'articles, avec des erreurs possibles de localisation ou de qualification. Pour limiter le bruit, seuls sont conservés les événements de <strong>violence matérielle</strong> (assauts, combats, violences de masse), localisés à l'échelle d'une <strong>ville ou d'une région</strong> (pas d'un pays entier) et rapportés par <strong>au moins 2 sources distinctes</strong>. Ils sont agrégés par lieu et par type. Les fichiers publiés toutes les 15 minutes sont collectés en continu : l'historique disponible commence donc à la mise en service de la collecte, et peut être plus court que la période demandée.</p>
    </section>

    <section>
      <h2>Couches de contexte</h2>
      <table class="doc-table">
        <thead><tr><th>Couche</th><th>Fournisseur</th><th>Fraîcheur</th><th>Licence</th><th>Remarque</th></tr></thead>
        <tbody>${layers}</tbody>
      </table>
      <p>Ces couches proviennent de bases collaboratives : elles sont incomplètes et peuvent contenir des erreurs. Elles se limitent volontairement à des sites <strong>civils ou publics et documentés</strong>.</p>
    </section>

    <section>
      <h2>Sources envisagées, non intégrées</h2>
      <p>Ces sources ont été évaluées mais ne sont pas utilisées, pour les raisons indiquées :</p>
      <ul>${notIntegrated}</ul>
    </section>

    <section>
      <h2>Fraîcheur et disponibilité</h2>
      <ul>
        <li>Chaque couche affiche le nombre d'éléments et l'heure de la donnée. Une pastille orange « du JJ/MM HH:MM » signale que la source est injoignable : c'est alors la <strong>dernière donnée réelle en cache</strong> qui est affichée, jamais une donnée fabriquée.</li>
        <li>« indisponible » signifie qu'aucune donnée réelle n'a pu être obtenue ; la cause est visible au survol.</li>
        <li>La bannière en haut du globe résume l'état des sources de conflits en temps réel.</li>
      </ul>
    </section>

    <section>
      <h2>Limites connues</h2>
      <ul>
        <li>Les sources ne couvrent pas tout : la presse et les analystes voient surtout ce qui est accessible et médiatisé.</li>
        <li>Les décalages varient de quelques minutes (GDELT) à plusieurs mois (UCDP annuel). Une timeline « jusqu'à aujourd'hui » ne prétend pas à l'exhaustivité du jour.</li>
        <li>Les coordonnées sont parfois approximatives (centre d'une ville ou d'une région). Les événements UCDP dont la localisation est plus large qu'une région (cumuls nationaux, zones maritimes) <strong>ne sont pas cartographiés</strong> : leur nombre est indiqué dans le panneau des sources.</li>
      </ul>
    </section>

    <section>
      <h2>Crédits et attributions</h2>
      <ul>
        ${credits}
        <li><strong>Contrôle territorial</strong> — contient des informations issues de VIINA 2.0 (Université Notre-Dame), mises à disposition sous licence <a href="https://opendatacommons.org/licenses/odbl/1.0/" target="_blank" rel="noopener noreferrer">ODbL</a>.</li>
        <li><strong>Données de conflits</strong> — ACLED, UCDP (Uppsala University) et GDELT, selon leurs conditions respectives ci-dessus.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}
