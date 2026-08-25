# Cypher Raw HTML Tab

Standalone Foundry VTT module for Foundry v14 that adds a raw HTML tab to Cypher System actor sheets.

## What it does

- Adds a new tab to Cypher System actor sheets.
- Stores raw HTML in an actor flag instead of a ProseMirror-backed field.
- Renders the stored markup directly into the tab.
- Optionally re-executes embedded `<script>` tags if the world setting is enabled.

## Installation

1. Copy the `cypher-raw-html-tab` folder into your Foundry Data `modules/` directory.
2. Enable the module in a Cypher System world.
3. Open any actor sheet and use the new tab.

## Important warning

This module intentionally bypasses the normal rich-text sanitization path for the custom tab. Anyone who can edit the actor and paste unsafe HTML/JS can potentially execute arbitrary code in the Foundry client.

Use only in trusted worlds.

## Notes

- The tab content is stored at `actor.flags.cypher-raw-html-tab.content`.
- Script tags inserted with `innerHTML` do not execute automatically in browsers, so the optional setting re-inserts them as live nodes after render.
- This module does not modify existing Cypher System Notes/Description tabs. It adds a separate tab so system updates are less likely to break your content.
