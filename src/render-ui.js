import { formatTime } from "./ride.js";

export function installRenderUI({
  getWorld,
  ride,
  soundtrack,
  pauseRide,
  setExporting,
  toast,
}) {
  const dialog = document.createElement("dialog");
  dialog.id = "render-dialog";
  dialog.setAttribute("aria-labelledby", "render-title");
  dialog.innerHTML = `<button class="dialog-close icon-button" id="render-close" aria-label="Close video export">×</button><div class="eyebrow">TAKE THE WORLD WITH YOU</div><h2 id="render-title">Keep the rush.</h2><p>Render a film of the ride with its soundtrack. Clean footage, no interface, and every single frame.</p><div class="render-spec"><span>60 FPS</span><span>H.264 MP4</span><span>AAC AUDIO</span></div><label class="render-label" for="render-resolution">Resolution</label><select id="render-resolution"><option value="1080">Full HD · 1920 × 1080</option><option value="2160">4K · 3840 × 2160</option></select><label class="render-label" for="render-length">Length</label><select id="render-length"><option value="full">Full ride</option><option value="preview">12-second collision preview</option></select><p class="render-note">Rendering may take a few minutes. Keep this tab open. The video includes the currently selected soundtrack and soft sound effects.</p><div id="render-progress-area" hidden><progress id="render-progress" value="0" max="100"></progress><strong id="render-status" role="status">Preparing…</strong><small id="render-remaining"></small></div><button class="primary-button dialog-done" id="render-start">Render video <span>↗</span></button><button id="render-cancel" class="text-button" hidden>Cancel render</button><a id="render-download" class="primary-button dialog-done" hidden>Download MP4 <span>↓</span></a>`;
  document.body.appendChild(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  let aborter, resultUrl;
  const opener = document.createElement("button");
  opener.id = "render-button";
  opener.className = "icon-button";
  opener.setAttribute("aria-label", "Render video");
  opener.title = "Render 60 fps video";
  opener.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 4v4m5-4v4m5-4v4m-6 4 5 3-5 3z"/></svg>';
  document.querySelector(".footer-controls").prepend(opener);
  opener.addEventListener("click", () => {
    if (ride.state === "riding") pauseRide();
    $('#render-length option[value="full"]').textContent =
      `Full ride · ${formatTime(ride.duration)}`;
    dialog.showModal();
  });
  $("#render-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    if (aborter) event.preventDefault();
  });
  $("#render-cancel").addEventListener("click", () => aborter?.abort());
  $("#render-start").addEventListener("click", async () => {
    const world = getWorld();
    if (!world) return;
    soundtrack.pause();
    setExporting(true);
    aborter = new AbortController();
    $("#render-start").disabled = true;
    $("#render-close").disabled = true;
    $("#render-resolution").disabled = true;
    $("#render-length").disabled = true;
    $("#render-cancel").hidden = false;
    $("#render-progress-area").hidden = false;
    $("#render-download").hidden = true;
    const height = Number($("#render-resolution").value),
      preview = $("#render-length").value === "preview";
    try {
      const { renderVideo } = await import("./export-video.js");
      const blob = await renderVideo({
        world,
        duration: ride.duration,
        file: soundtrack.file,
        volume: soundtrack.muted ? 0 : soundtrack.volume,
        effectsVolume: soundtrack.effectsVolume,
        width: (height * 16) / 9,
        height,
        preview,
        signal: aborter.signal,
        onProgress: ({ percent, label, remaining }) => {
          $("#render-progress").value = percent;
          $("#render-status").textContent = label;
          $("#render-remaining").textContent = remaining
            ? `About ${formatTime(remaining)} remaining · ${percent}%`
            : "Preparing your film";
        },
      });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(blob);
      const filename = `pixelrush-${preview ? "preview-" : ""}${height}p60.mp4`;
      let savedLocally = false;
      if (import.meta.env.DEV) {
        $("#render-status").textContent = "Saving the film to your project…";
        const result = await fetch(
          `/__pixelrush/render?name=${encodeURIComponent(filename)}`,
          {
            method: "POST",
            headers: { "Content-Type": "video/mp4" },
            body: blob,
            signal: aborter.signal,
          },
        );
        if (!result.ok)
          throw new Error(
            "The film rendered, but saving it to the project failed.",
          );
        savedLocally = true;
      }
      $("#render-download").href = resultUrl;
      $("#render-download").download = filename;
      $("#render-download").hidden = false;
      $("#render-status").textContent = savedLocally
        ? `Saved to renders/${filename}`
        : "Your film is ready.";
      $("#render-remaining").textContent =
        `${height === 2160 ? "3840 × 2160" : "1920 × 1080"} · 60 fps · ${(blob.size / 1048576).toFixed(1)} MB`;
    } catch (error) {
      console.error("Video render:", error);
      $("#render-status").textContent =
        error.name === "AbortError" ? "Render cancelled." : error.message;
      $("#render-remaining").textContent = "";
      if (error.name !== "AbortError")
        toast(
          "Video export could not finish. See the export panel for details.",
        );
    } finally {
      aborter = null;
      setExporting(false);
      $("#render-start").disabled = false;
      $("#render-close").disabled = false;
      $("#render-resolution").disabled = false;
      $("#render-length").disabled = false;
      $("#render-cancel").hidden = true;
    }
  });
}
