"use strict";

(() => {
  const gallery = document.getElementById("sequence-gallery");
  const canvas = document.getElementById("sequence-screen");
  const buffer = document.createElement("canvas");
  const width = 512;
  const height = 416;
  buffer.width = width * 2;
  buffer.height = height;
  const packed = buffer.getContext("2d", { alpha: false });
  const screen = canvas.getContext("2d", { alpha: false });
  if (!packed || !screen) return;

  const choices = [...gallery.querySelectorAll("button[data-scene]")];
  const modes = [...gallery.querySelectorAll("button[data-mode]")];
  const title = document.getElementById("sequence-title");
  const poster = document.getElementById("sequence-poster");
  const wipe = document.getElementById("sequence-wipe");
  const frame = gallery.querySelector(".sequence-frame");
  const leftLabel = document.getElementById("sequence-left");
  const rightLabel = document.getElementById("sequence-right");
  const play = document.getElementById("sequence-play");
  const seek = document.getElementById("sequence-seek");
  const time = document.getElementById("sequence-time");
  const message = document.getElementById("sequence-message");
  const clipLink = document.getElementById("sequence-file");
  const stillLink = document.getElementById("sequence-original");
  let video = document.getElementById("sequence-video");
  const videoTemplate = video.cloneNode(false);
  const fps = Number(gallery.dataset.fps);
  const duration = Number(gallery.dataset.frames) / fps;
  const lastTime = duration - 1 / fps;
  let mode = "wipe";
  let active;
  let playing = false;
  let hasDecodedFrame = false;
  let pendingSeek = null;
  let scrubbing = false;
  let cancelPaint = null;
  seek.max = String(lastTime);

  function render() {
    if (mode === "pair") {
      screen.drawImage(buffer, 0, 0);
      return;
    }
    screen.drawImage(buffer, 0, 0, width, height, 0, 0, width, height);
    const boundary = Math.round(width * Number(wipe.value) / 100);
    if (boundary > 0) {
      screen.drawImage(buffer, width, 0, boundary, height, 0, 0, boundary, height);
    }
  }

  function layout(value) {
    mode = value;
    gallery.dataset.mode = mode;
    canvas.width = mode === "wipe" ? width : width * 2;
    canvas.height = height;
    wipe.hidden = mode !== "wipe";
    leftLabel.textContent = mode === "wipe" ? "Reference depth" : "RGB";
    rightLabel.textContent = mode === "wipe" ? "RGB" : "Reference depth";
    updateLabels();
    modes.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
    render();
  }

  function updateLabels() {
    const frameRect = frame.getBoundingClientRect();
    const split = frameRect.left + frameRect.width * Number(wipe.value) / 100;
    const hideLeft = mode === "wipe" && leftLabel.getBoundingClientRect().right > split;
    const hideRight = mode === "wipe" && rightLabel.getBoundingClientRect().left < split;
    leftLabel.style.visibility = hideLeft ? "hidden" : "";
    rightLabel.style.visibility = hideRight ? "hidden" : "";
  }

  function updateSplit() {
    gallery.style.setProperty("--wipe", wipe.value + "%");
    wipe.setAttribute("aria-valuetext", wipe.value + "% reference depth");
    updateLabels();
    render();
  }

  function clock(seconds) {
    if (!scrubbing) seek.value = String(Math.min(seconds, lastTime));
    time.textContent = seconds.toFixed(1) + " / " + duration.toFixed(1) + " s";
    seek.setAttribute("aria-valuetext", seconds.toFixed(2) + " seconds");
  }

  function notify(text) {
    message.hidden = !text;
    message.textContent = text;
  }

  function playbackState(value) {
    playing = value;
    play.classList.toggle("is-playing", value);
    play.querySelector(".play-text").textContent = value ? "Pause" : "Play";
  }

  function capture() {
    if (video.readyState < 2 || video.seeking || video.videoWidth !== width * 2) return;
    packed.drawImage(video, 0, 0, buffer.width, buffer.height);
    hasDecodedFrame = true;
    render();
    clock(video.currentTime);
  }

  function schedule() {
    if (cancelPaint || !playing || video.paused) return;
    const source = video;
    function nextFrame() {
      if (source !== video) return;
      cancelPaint = null;
      capture();
      schedule();
    }
    if (typeof source.requestVideoFrameCallback === "function") {
      const id = source.requestVideoFrameCallback(nextFrame);
      cancelPaint = () => source.cancelVideoFrameCallback(id);
    } else {
      const id = requestAnimationFrame(nextFrame);
      cancelPaint = () => cancelAnimationFrame(id);
    }
  }

  function stopPainting() {
    if (cancelPaint) cancelPaint();
    cancelPaint = null;
  }

  function loadClip() {
    if (!video.hasAttribute("src")) {
      video.preload = "auto";
      video.src = clipLink.href;
      video.load();
    }
    return video;
  }

  function start() {
    const source = loadClip();
    notify("");
    playbackState(true);
    source.play().catch(error => {
      if (source !== video || error.name === "AbortError") return;
      playbackState(false);
      notify("Playback is unavailable here. Open Paired MP4 to view this clip.");
    });
  }

  function pause() {
    playbackState(false);
    stopPainting();
    video.pause();
  }

  function jump(seconds) {
    const target = Math.min(lastTime, Math.max(0, seconds));
    const source = loadClip();
    clock(target);
    if (source.readyState >= 1) {
      pendingSeek = null;
      source.currentTime = target;
    } else {
      pendingSeek = target;
    }
  }

  function bindSource(source) {
    function listen(type, handler) {
      source.addEventListener(type, () => { if (source === video) handler(); });
    }
    listen("loadedmetadata", () => {
      if (pendingSeek !== null) {
        source.currentTime = pendingSeek;
        pendingSeek = null;
      }
    });
    listen("loadeddata", capture);
    listen("seeked", capture);
    listen("timeupdate", capture);
    listen("playing", schedule);
    listen("pause", () => {
      if (source.paused) {
        playbackState(false);
        stopPainting();
      }
    });
    listen("error", () => {
      pause();
      notify("This clip could not play. Open Paired MP4 or inspect the lossless first frame.");
    });
  }

  function select(button) {
    if (button === active) return;
    const resume = playing;
    if (active) {
      const old = video;
      pause();
      video = videoTemplate.cloneNode(false);
      old.replaceWith(video);
      if (old.hasAttribute("src")) {
        old.removeAttribute("src");
        old.load();
      }
    }
    active = button;
    const prefix = "site-assets/sequences/" + button.dataset.scene;
    const label = button.querySelector("span").textContent;
    title.textContent = label;
    canvas.setAttribute("aria-label", label + ", synchronized camera 2 RGB and reference depth");
    choices.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    stillLink.href = prefix + "-poster.webp";
    clipLink.href = prefix + ".mp4";
    notify("");
    hasDecodedFrame = false;
    pendingSeek = null;
    scrubbing = false;
    packed.fillStyle = "#101713";
    packed.fillRect(0, 0, buffer.width, buffer.height);
    render();
    clock(0);
    const stillURL = stillLink.href;
    function paintPoster() {
      if (button !== active || hasDecodedFrame || poster.currentSrc !== stillURL || poster.naturalWidth !== buffer.width) return;
      packed.drawImage(poster, 0, 0);
      render();
    }
    poster.onload = paintPoster;
    poster.onerror = () => { if (button === active) notify("First frame unavailable. Press Play to load this clip."); };
    poster.src = stillURL;
    poster.alt = label + ", with camera 2 RGB on the left and reference depth on the right.";
    if (poster.complete) paintPoster();
    video.hidden = false;
    video.muted = true;
    bindSource(video);
    if (resume) start();
  }

  for (const button of choices) {
    button.addEventListener("click", () => {
      select(button);
      if (location.protocol === "https:" || location.protocol === "http:") {
        const url = new URL(location.href);
        url.searchParams.set("scene", button.dataset.scene);
        history.replaceState(history.state, "", url);
      }
    });
  }
  for (const link of document.querySelectorAll("a[data-feature]")) {
    const button = choices.find(item => item.dataset.scene === link.dataset.feature);
    if (!button || !["https:", "http:"].includes(location.protocol)) continue;
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set("scene", button.dataset.scene);
    url.hash = gallery.id;
    link.href = url.href;
    link.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (url.href !== location.href) history.pushState(null, "", url);
      select(button);
      gallery.focus({ preventScroll: true });
      gallery.scrollIntoView();
    });
  }

  for (const button of modes) button.addEventListener("click", () => layout(button.dataset.mode));
  play.addEventListener("click", () => playing ? pause() : start());
  wipe.addEventListener("input", updateSplit);
  seek.addEventListener("input", () => jump(Number(seek.value)));
  seek.addEventListener("pointerdown", () => { scrubbing = true; });
  for (const event of ["pointerup", "pointercancel"]) {
    window.addEventListener(event, () => { scrubbing = false; });
  }
  for (const button of gallery.querySelectorAll("[data-step]")) {
    button.addEventListener("click", () => {
      pause();
      const current = pendingSeek ?? (video.seeking ? Number(seek.value) : video.currentTime);
      const frame = Math.floor(current * fps + 0.0001) + Number(button.dataset.step);
      // Aim inside the frame to avoid rounding a seek back across its timestamp.
      jump((frame + 0.1) / fps);
    });
  }

  gallery.classList.add("gallery-ready");
  poster.hidden = true;
  canvas.hidden = false;
  layout(mode);
  updateSplit();
  if (typeof ResizeObserver === "function") {
    const labelObserver = new ResizeObserver(updateLabels);
    for (const element of [frame, leftLabel, rightLabel]) labelObserver.observe(element);
  } else {
    window.addEventListener("resize", updateLabels);
  }

  function selectFromAddress() {
    const requested = new URLSearchParams(location.search).get("scene");
    select(choices.find(button => button.dataset.scene === requested) || choices[0]);
  }
  selectFromAddress();
  window.addEventListener("popstate", selectFromAddress);
})();
