import { useEffect, useState, type FormEvent } from "react";
import { Check, TriangleAlert } from "lucide-react";
import * as api from "../api";
import type { Settings } from "../types";

const lines = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function SettingsPanel({
  settings,
  save,
}: {
  settings: Settings;
  save: (next: Settings) => Promise<Settings>;
}) {
  const [reviewHours, setReviewHours] = useState(String(settings.reviewHours));
  const [roots, setRoots] = useState(settings.projectRoots.join("\n"));
  const [binaries, setBinaries] = useState(settings.devBinaries.join(", "));
  const [editor, setEditor] = useState(settings.editor ?? "");
  const [editors, setEditors] = useState<string[]>([]);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  useEffect(() => {
    setReviewHours(String(settings.reviewHours));
    setRoots(settings.projectRoots.join("\n"));
    setBinaries(settings.devBinaries.join(", "));
    setEditor(settings.editor ?? "");
  }, [settings]);
  useEffect(() => {
    if (!api.native) return;
    api
      .listEditors()
      .then(setEditors)
      .catch(() => undefined);
    api
      .getAutostart()
      .then(setAutostart)
      .catch(() => setAutostart(null));
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const saved = await save({
        reviewHours: Number(reviewHours),
        projectRoots: lines(roots),
        devBinaries: lines(binaries),
        editor: editor || null,
      });
      setStatus({
        ok: true,
        text:
          saved.devBinaries.length || saved.projectRoots.length
            ? "Réglages enregistrés. Le prochain relevé les applique."
            : "Réglages enregistrés.",
      });
    } catch (error) {
      setStatus({ ok: false, text: String(error) });
    }
  }
  async function toggleAutostart(enabled: boolean) {
    try {
      setAutostart(await api.setAutostart(enabled));
    } catch (error) {
      setStatus({ ok: false, text: String(error) });
    }
  }
  const editorChoices =
    editor && !editors.includes(editor) ? [editor, ...editors] : editors;
  return (
    <section className="settings-panel" aria-label="Réglages">
      {!api.native && (
        <div className="notice warning-notice">
          <TriangleAlert aria-hidden="true" size={18} />
          <p>Les réglages sont enregistrés par l’application Mac.</p>
        </div>
      )}
      <form onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label htmlFor="review-hours">Délai avant « À vérifier »</label>
          <div className="field-inline">
            <input
              id="review-hours"
              type="number"
              min={1}
              max={168}
              required
              value={reviewHours}
              onChange={(e) => setReviewHours(e.target.value)}
            />
            <span>heures</span>
          </div>
          <p>
            Un serveur de développement actif depuis plus longtemps est signalé.
          </p>
        </div>
        <div className="field">
          <label htmlFor="project-roots">Dossiers de projets</label>
          <textarea
            id="project-roots"
            rows={3}
            value={roots}
            placeholder={"~/code\n~/Developer"}
            onChange={(e) => setRoots(e.target.value)}
          />
          <p>
            Un dossier par ligne. Le premier sous-dossier donne le nom du
            projet. Les dossiers GitHub restent reconnus.
          </p>
        </div>
        <div className="field">
          <label htmlFor="dev-binaries">Autres serveurs de développement</label>
          <input
            id="dev-binaries"
            value={binaries}
            placeholder="mysqld, rails, beam.smp"
            onChange={(e) => setBinaries(e.target.value)}
          />
          <p>
            Noms de programmes séparés par des virgules, en plus de node,
            python, ruby… Le moteur Docker et les services macOS restent
            protégés.
          </p>
        </div>
        <div className="field">
          <label htmlFor="editor">Éditeur</label>
          <select
            id="editor"
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
          >
            <option value="">Aucun</option>
            {editorChoices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p>Ajoute « Ouvrir dans l’éditeur » aux détails d’un service.</p>
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="submit">
            Enregistrer
          </button>
          {status && (
            <span
              className={`settings-status ${status.ok ? "ok" : "error"}`}
              role={status.ok ? "status" : "alert"}
            >
              {status.ok ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <TriangleAlert aria-hidden="true" size={15} />
              )}
              {status.text}
            </span>
          )}
        </div>
      </form>
      <div className="field toggle-field">
        <label>
          <input
            type="checkbox"
            checked={autostart ?? false}
            disabled={autostart === null}
            onChange={(e) => void toggleAutostart(e.target.checked)}
          />
          Ouvrir Portlight à la connexion
        </label>
        <p>
          Portlight démarre dans la barre des menus, sans ouvrir de fenêtre.
          Fermer la fenêtre garde Portlight dans la barre des menus.
        </p>
      </div>
    </section>
  );
}
