#!/usr/bin/env python3
"""Fetch a YouTube playlist and save it as JSON for the website to read.

Runs on a schedule in GitHub Actions, so the API key stays in repository
secrets and never appears in the site's code.

Environment variables:
  YT_API_KEY      Required. YouTube Data API v3 key.
  YT_PLAYLIST_ID  Playlist to read. Default: Gregg's vertical series.
  OUT_PATH        Where to write the JSON. Default: Gregg/data/playlist.json
  YT_REFERER      Optional. Sent as the Referer header. Needed when the key has a
                  Websites restriction, and must match an allowed entry. Keep it secret.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

API = "https://www.googleapis.com/youtube/v3/playlistItems"
THUMB_ORDER = ("maxres", "standard", "high", "medium", "default")
# Rewrite the file at least this often, even with no changes. GitHub pauses
# scheduled workflows in public repos after 60 days without repository activity.
HEARTBEAT_DAYS = 30


def redact(text, *secrets):
    """Remove secret values from text. Actions logs are public for a public repo."""
    for secret in secrets:
        if not secret:
            continue
        text = text.replace(secret, "[redacted]")
        host = urllib.parse.urlsplit(secret).hostname
        if host:
            text = text.replace(host, "[redacted]")
    return text


def fetch_videos(key, playlist_id, referer=None):
    videos, page_token = [], None
    while True:
        params = {"part": "snippet", "maxResults": 50, "playlistId": playlist_id, "key": key}
        if page_token:
            params["pageToken"] = page_token
        req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params))
        if referer:
            req.add_header("Referer", referer)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.load(resp)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")[:500]
            hint = ""
            if "referer" in body.lower():
                hint = "\nHint: the YT_REFERER secret must match the key's Websites restriction."
            sys.exit(f"YouTube API error {e.code}: {redact(body, key, referer)}{hint}")
        except urllib.error.URLError as e:
            sys.exit(f"Could not reach the YouTube API: {e.reason}")

        for item in data.get("items", []):
            sn = item.get("snippet") or {}
            video_id = (sn.get("resourceId") or {}).get("videoId")
            title = (sn.get("title") or "").strip()
            if not video_id or title in ("Deleted video", "Private video"):
                continue
            thumbs = sn.get("thumbnails") or {}
            best = next((thumbs[k] for k in THUMB_ORDER if k in thumbs), {})
            videos.append({"id": video_id, "title": title, "thumb": best.get("url", "")})

        page_token = data.get("nextPageToken")
        if not page_token:
            return videos


def main():
    key = os.environ.get("YT_API_KEY", "").strip()
    if not key:
        sys.exit("YT_API_KEY is not set.")
    playlist_id = os.environ.get("YT_PLAYLIST_ID", "PLEs8E2bytK9M")
    out_path = os.environ.get("OUT_PATH", "Gregg/data/playlist.json")

    videos = fetch_videos(key, playlist_id, os.environ.get("YT_REFERER"))
    if not videos:
        sys.exit("The playlist returned no public videos. Keeping the existing file.")

    try:
        with open(out_path, encoding="utf-8") as f:
            old = json.load(f)
    except (FileNotFoundError, ValueError):
        old = {}

    today = date.today()
    checked = old.get("checked")
    age_days = (today - date.fromisoformat(checked)).days if checked else None
    if old.get("videos") == videos and age_days is not None and age_days < HEARTBEAT_DAYS:
        print(f"No change ({len(videos)} videos).")
        return

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"playlistId": playlist_id, "checked": today.isoformat(), "videos": videos},
                  f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"Wrote {len(videos)} videos to {out_path}.")


if __name__ == "__main__":
    main()
