import { useEffect, useState, type FormEvent } from "react";
import { Check, TriangleAlert } from "lucide-react";
import * as api from "../api";
import { LANGUAGES, useT, type Language } from "../i18n";
import type { Settings } from "../types";

const lines = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function SettingsPanel({
  settings,
  save,
  setLanguage,
}: {
  settings: Settings;
  save: (next: Settings) => Promise<Settings>;
  setLanguage: (language: Language) => void;
}) {
  const t = useT();
  const l = t.settings;
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
        ...settings,
        reviewHours: Number(reviewHours),
        projectRoots: lines(roots),
        devBinaries: lines(binaries),
        editor: editor || null,
      });
      setStatus({
        ok: true,
        text:
          saved.devBinaries.length || saved.projectRoots.length
            ? l.savedNextScan
            : l.saved,
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
    <section className="settings-panel" aria-label={l.label}>
      {!api.native && (
        <div className="notice warning-notice">
          <TriangleAlert aria-hidden="true" size={18} />
          <p>{l.webOnly}</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="language">{l.language}</label>
        <select
          id="language"
          value={settings.language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          {LANGUAGES.map(({ id, name }) => (
            <option key={id} value={id} lang={id}>
              {name}
            </option>
          ))}
        </select>
        <p>{l.languageText}</p>
      </div>
      <form onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label htmlFor="review-hours">{l.reviewHours}</label>
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
            <span>{l.hours}</span>
          </div>
          <p>{l.reviewHoursText}</p>
        </div>
        <div className="field">
          <label htmlFor="project-roots">{l.roots}</label>
          <textarea
            id="project-roots"
            rows={3}
            value={roots}
            placeholder={"~/code\n~/Developer"}
            onChange={(e) => setRoots(e.target.value)}
          />
          <p>{l.rootsText}</p>
        </div>
        <div className="field">
          <label htmlFor="dev-binaries">{l.binaries}</label>
          <input
            id="dev-binaries"
            value={binaries}
            placeholder="surreal, deno, beam.smp"
            onChange={(e) => setBinaries(e.target.value)}
          />
          <p>{l.binariesText}</p>
        </div>
        <div className="field">
          <label htmlFor="editor">{l.editor}</label>
          <select
            id="editor"
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
          >
            <option value="">{l.none}</option>
            {editorChoices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p>{l.editorText}</p>
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="submit">
            {l.save}
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
          {l.autostart}
        </label>
        <p>{l.autostartText}</p>
      </div>
    </section>
  );
}
