{
  "brand": {
    "name": "Night-Lab Containment OS",
    "attributes": [
      "mysterious",
      "clinical",
      "high-contrast",
      "bioluminescent accents",
      "dense-but-readable",
      "rewarding discovery feedback"
    ],
    "north_star": "A near-future containment facility operating system wrapped around a dark stylised isometric world: solid dark panels, crisp data typography, and restrained glow only for anomalous/interactive states."
  },

  "design_tokens": {
    "css_custom_properties": {
      "notes": "Define these in /app/frontend/src/index.css under :root and .dark. Keep panels near-solid (no true transparency). Avoid heavy blur; use subtle inner highlights + 1px borders.",
      "colors_ui": {
        "--bg-0": "#070A0E",
        "--bg-1": "#0B1018",
        "--bg-2": "#0F1724",
        "--panel": "#0C121B",
        "--panel-2": "#101A26",
        "--panel-3": "#0A0F16",
        "--text-1": "#E7EEF8",
        "--text-2": "#B7C4D6",
        "--text-3": "#7F93AD",
        "--border": "#1B2A3D",
        "--border-2": "#24384F",
        "--shadow": "0 18px 40px rgba(0,0,0,0.55)",

        "--accent-cyan": "#2DE2E6",
        "--accent-seaglass": "#6EF3C5",
        "--accent-violet": "#8AA4FF",
        "--accent-amber": "#F2C14E",
        "--accent-rose": "#FF5C7A",

        "--success": "#3EE28A",
        "--warning": "#F2C14E",
        "--danger": "#FF4D6D",
        "--info": "#4DB6FF",

        "--focus-ring": "rgba(45,226,230,0.55)",
        "--selection": "#2DE2E6",
        "--selection-soft": "rgba(45,226,230,0.18)",

        "--unknown": "#FF5C7A",
        "--unknown-bg": "#1A0E14",
        "--unknown-border": "#3A1422"
      },
      "colors_world_canvas": {
        "notes": "Hex palette for the canvas renderer. Keep terrain dark but not crushed; reserve the brightest values for selection + bioluminescence. Use outlines for readability at 1080p.",
        "base_lighting": {
          "world_void": "#05070B",
          "ambient_shadow": "#070B12",
          "rim_light": "#1A2A3A"
        },
        "terrain_materials": {
          "grassland": "#1B2A22",
          "grassland_highlight": "#2A3D31",
          "rock": "#2A2F38",
          "rock_highlight": "#3A4250",
          "sand": "#3A3326",
          "sand_highlight": "#4A4130",
          "wetland": "#162A2B",
          "wetland_highlight": "#1F3A3C",
          "mud": "#2B221E",
          "mud_highlight": "#3A2E28",
          "fungal": "#2A1E2F",
          "fungal_highlight": "#3A2A42",
          "alien_soil": "#1A2233",
          "alien_soil_highlight": "#24304A"
        },
        "water": {
          "shallow": "#0E2A33",
          "mid": "#0A1F2A",
          "deep": "#07141F",
          "foam_edge": "#2DE2E6"
        },
        "vegetation": {
          "low": "#163326",
          "mid": "#1E4A35",
          "high": "#2A6A4A",
          "biolume_veins": "#6EF3C5",
          "biolume_spores": "#2DE2E6"
        },
        "structures": {
          "paths": "#1B2430",
          "paths_edge": "#2A3A4F",
          "fence_t1": "#2A3442",
          "fence_t2": "#3A4A60",
          "fence_t3": "#4A5F7A",
          "buildings": "#121A24",
          "building_lights": "#8AA4FF"
        },
        "creatures": {
          "silhouette": "#0A0F16",
          "silhouette_edge": "#1B2A3D",
          "rare_glow": "#8AA4FF",
          "anomaly_glow": "#2DE2E6"
        },
        "interaction_states": {
          "hover_outline": "#8AA4FF",
          "selected_outline": "#2DE2E6",
          "selected_fill": "rgba(45,226,230,0.10)",
          "valid_placement": "#3EE28A",
          "valid_fill": "rgba(62,226,138,0.12)",
          "invalid_placement": "#FF4D6D",
          "invalid_fill": "rgba(255,77,109,0.14)",
          "blueprint_preview": "#4DB6FF",
          "blueprint_fill": "rgba(77,182,255,0.10)",
          "grid_lines": "rgba(36,56,79,0.55)",
          "area_overlay_dim": "rgba(7,10,14,0.55)"
        }
      },
      "typography": {
        "font_pairing": {
          "ui": "Space Grotesk (Google Fonts)",
          "data_mono": "IBM Plex Mono (Google Fonts)"
        },
        "css_vars": {
          "--font-ui": "'Space Grotesk', ui-sans-serif, system-ui",
          "--font-mono": "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
        },
        "scale": {
          "h1": "text-4xl sm:text-5xl lg:text-6xl",
          "h2": "text-base md:text-lg",
          "body": "text-sm md:text-base",
          "small": "text-xs"
        },
        "rules": [
          "Use UI font for headings + labels; use mono for numbers, timers, coordinates, research IDs.",
          "Default line-height: 1.35 for dense panels; 1.55 for long-form modal text.",
          "Use tabular-nums for all numeric readouts (cash, guests, progress)."
        ]
      },
      "spacing_radius": {
        "grid": "8px base spacing; panels use 16/24/32px increments",
        "radius": {
          "--radius-sm": "10px",
          "--radius-md": "14px",
          "--radius-lg": "18px"
        },
        "stroke": {
          "hairline": "1px borders",
          "divider": "1px separators with --border"
        }
      },
      "shadows_glow": {
        "panel_shadow": "0 18px 40px rgba(0,0,0,0.55)",
        "glow_cyan": "0 0 0 1px rgba(45,226,230,0.25), 0 0 18px rgba(45,226,230,0.12)",
        "glow_success": "0 0 0 1px rgba(62,226,138,0.22), 0 0 18px rgba(62,226,138,0.10)",
        "glow_danger": "0 0 0 1px rgba(255,77,109,0.22), 0 0 18px rgba(255,77,109,0.10)"
      }
    }
  },

  "layout": {
    "desktop_first_rules": [
      "Target 1920×1080 as reference; scale down to 1366×768 with tighter spacing but keep font sizes readable.",
      "Canvas is full-screen; UI is chrome overlays with fixed regions: top HUD, bottom-left build tools, right inspect panel, small top-right overlay toggles.",
      "Never center the whole app container; align content to edges like an OS."
    ],
    "regions": {
      "top_hud": {
        "height": "56px (compact) / 64px (comfortable)",
        "layout": "Left: park name + date; Center: time controls; Right: KPIs + alerts",
        "pattern": "Use a solid panel bar with subtle bottom border and a thin cyan ‘status line’ (2px) only under active/alert states."
      },
      "bottom_left_build_toolbar": {
        "width": "360–420px",
        "height": "auto; max 42vh",
        "pattern": "Tabs for categories + sub-palette grid for tools; keep tool icons 20–22px with text labels."
      },
      "right_inspect_panel": {
        "width": "420–520px",
        "behavior": "Slides in/out; resizable optional using shadcn resizable",
        "pattern": "Header with entity name + status chips; body uses ScrollArea; sections separated by hairline separators."
      },
      "overlay_toggles_cluster": {
        "position": "top-right under HUD",
        "pattern": "Icon-only ToggleGroup with tooltips; show active state with cyan ring + subtle fill."
      }
    },
    "grid_system": {
      "panel_internal": "12-column grid inside modals; 8px gap; cards span 3/4/6 columns depending on density",
      "hud": "Use flex with fixed KPI blocks (min-w 120px) and mono numbers"
    }
  },

  "components": {
    "component_path": {
      "core": [
        "/app/frontend/src/components/ui/button.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/toggle-group.jsx",
        "/app/frontend/src/components/ui/tooltip.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/dialog.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/slider.jsx",
        "/app/frontend/src/components/ui/separator.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/sonner.jsx"
      ],
      "nice_to_have": [
        "/app/frontend/src/components/ui/resizable.jsx",
        "/app/frontend/src/components/ui/hover-card.jsx",
        "/app/frontend/src/components/ui/collapsible.jsx",
        "/app/frontend/src/components/ui/command.jsx",
        "/app/frontend/src/components/ui/context-menu.jsx",
        "/app/frontend/src/components/ui/menubar.jsx",
        "/app/frontend/src/components/ui/calendar.jsx"
      ]
    },
    "panel_style_recipe": {
      "tailwind": "bg-[var(--panel)] text-[var(--text-1)] border border-[var(--border)] rounded-[var(--radius-md)] shadow-[var(--shadow)]",
      "header": "px-4 py-3 border-b border-[var(--border)] bg-[var(--panel-2)]",
      "section": "px-4 py-3",
      "divider": "h-px bg-[var(--border)]"
    },
    "buttons": {
      "variants": {
        "primary": {
          "use": "Main actions (Build, Confirm, Start Research)",
          "tailwind": "bg-[var(--accent-cyan)] text-[#061014] hover:bg-[#22cfd3] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] active:translate-y-[1px]",
          "shape": "rounded-[10px]",
          "motion": "transition-colors duration-150 (no transition-all)"
        },
        "secondary": {
          "use": "Less critical actions (Details, Pin, Filter)",
          "tailwind": "bg-[var(--panel-2)] text-[var(--text-1)] border border-[var(--border-2)] hover:bg-[#142235]",
          "motion": "transition-colors duration-150"
        },
        "ghost": {
          "use": "Icon buttons in HUD/toolbars",
          "tailwind": "bg-transparent text-[var(--text-2)] hover:bg-[#101a26] hover:text-[var(--text-1)]",
          "motion": "transition-colors duration-150"
        },
        "danger": {
          "use": "Demolish, Cancel build, Emergency actions",
          "tailwind": "bg-[var(--danger)] text-[#14060B] hover:bg-[#ff335a] focus-visible:ring-2 focus-visible:ring-[var(--glow_danger)]",
          "motion": "transition-colors duration-150"
        }
      },
      "sizes": {
        "sm": "h-8 px-3 text-xs",
        "md": "h-9 px-4 text-sm",
        "lg": "h-10 px-5 text-sm"
      }
    },
    "tool_states": {
      "tool_tile": {
        "default": "bg-[var(--panel-2)] border border-[var(--border)] text-[var(--text-2)]",
        "hover": "hover:border-[var(--border-2)] hover:text-[var(--text-1)]",
        "active": "data-[state=on]:border-[var(--accent-cyan)] data-[state=on]:shadow-[0_0_0_1px_rgba(45,226,230,0.25),0_0_18px_rgba(45,226,230,0.12)] data-[state=on]:text-[var(--text-1)]",
        "disabled": "opacity-50 pointer-events-none"
      }
    },
    "progress_bars_need_meters": {
      "rules": [
        "Always show icon + label + numeric value (e.g., Hunger 62%).",
        "Use color + pattern: add a small tick/stripe overlay for critical states so it’s not color-only."
      ],
      "colors": {
        "good": "--success",
        "ok": "--accent-amber",
        "bad": "--danger"
      },
      "tailwind_recipe": {
        "track": "bg-[#0A0F16] border border-[var(--border)]",
        "fill": "bg-[var(--success)]",
        "critical_fill": "bg-[var(--danger)]"
      }
    },
    "unknown_redacted_language": {
      "visual": [
        "Show UNKNOWN fields as redacted blocks with mono text: ‘UNKNOWN’ + hashed bar pattern.",
        "Use rose accent only for unknown/anomalous; do not reuse rose for generic errors (danger is separate)."
      ],
      "tailwind": {
        "chip": "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--unknown-bg)] text-[#ffb3c1] border border-[var(--unknown-border)]",
        "redaction_block": "rounded-md bg-[#12070D] border border-[#3A1422] px-2 py-1 font-mono text-xs text-[#ff8aa0]"
      },
      "microcopy": {
        "examples": [
          "UNKNOWN (requires observation)",
          "REDACTED — insufficient samples",
          "CLASSIFIED — research tier II"
        ]
      }
    }
  },

  "motion_microinteractions": {
    "principles": [
      "Motion is functional: confirm tool selection, panel transitions, discovery rewards.",
      "Keep durations short: 120–220ms for UI; 280–420ms for discovery moments.",
      "Avoid constant pulsing; reserve glow pulses for alerts/anomalies only."
    ],
    "recommended_library": {
      "name": "framer-motion",
      "install": "npm i framer-motion",
      "usage": "Use for InspectPanel slide-in, modal entrance, discovery toast emphasis."
    },
    "recipes": {
      "inspect_panel": {
        "enter": "x: 24 -> 0, opacity: 0 -> 1, duration 0.18",
        "exit": "x: 24, opacity: 0, duration 0.14"
      },
      "tool_select": {
        "behavior": "On select: quick ring + subtle scale 1.00 -> 1.02 -> 1.00 (120ms total)."
      },
      "discovery_breakthrough": {
        "behavior": "Toast expands slightly + cyan scanline sweep (CSS background-position animation) once; optional subtle screen-edge vignette flash (max 10% opacity)."
      }
    }
  },

  "notifications": {
    "system": "Use sonner (/app/frontend/src/components/ui/sonner.jsx).",
    "types": {
      "info": {
        "title": "NEW DATA",
        "accent": "--info"
      },
      "warning": {
        "title": "CONTAINMENT WARNING",
        "accent": "--warning"
      },
      "danger": {
        "title": "BREACH RISK",
        "accent": "--danger"
      },
      "breakthrough": {
        "title": "BIOLOGICAL BREAKTHROUGH",
        "accent": "--accent-cyan",
        "treatment": "Larger toast, mono ID line, cyan glow, optional subtle scanline texture."
      }
    },
    "click_to_navigate": "Toasts should include an action button (Button variant=secondary) and be keyboard focusable."
  },

  "data_visualization": {
    "libraries": [
      {
        "name": "recharts",
        "install": "npm i recharts",
        "use_cases": [
          "Finances breakdown (stacked area / bar)",
          "Enclosure composition bars",
          "Research progress timelines"
        ],
        "styling": "Use mono ticks, muted grid lines (rgba(36,56,79,0.35)), and accent lines in cyan/seaglass only."
      }
    ]
  },

  "accessibility": {
    "rules": [
      "WCAG AA contrast for all text on panels.",
      "Never rely on color alone: pair status colors with icons (lucide-react) and/or patterns (striped critical bars).",
      "Keyboard: all HUD controls reachable via Tab; tooltips appear on focus as well as hover.",
      "Respect prefers-reduced-motion: disable scanline sweeps and scale bounces."
    ],
    "focus": "Use visible focus rings: focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-0"
  },

  "testing": {
    "data_testid": {
      "rule": "All interactive and key informational elements MUST include data-testid (kebab-case, role-based).",
      "examples": [
        "data-testid=\"hud-cash-value\"",
        "data-testid=\"hud-time-pause-button\"",
        "data-testid=\"build-toolbar-category-tabs\"",
        "data-testid=\"inspect-panel-close-button\"",
        "data-testid=\"species-database-open-button\"",
        "data-testid=\"research-project-start-button\"",
        "data-testid=\"toast-breakthrough\""
      ]
    }
  },

  "images": {
    "image_urls": [
      {
        "category": "main-menu-background",
        "description": "Abstract dark lab / sci-fi corridor background (use as subtle, low-contrast backdrop behind menu panels; add noise overlay).",
        "url": "(INTENTIONALLY NONE — prefer procedural gradient + noise; avoid photorealism)"
      },
      {
        "category": "species-portraits",
        "description": "Creature portraits should be rendered in-game or illustrated; UI should support square portraits with a thin cyan edge when discovered.",
        "url": "(IN-GAME RENDER / ILLUSTRATION)"
      }
    ]
  },

  "implementation_notes_js": {
    "react_19": [
      "Prefer composition: <HudBar />, <BuildToolbar />, <InspectPanel />, <GameModals /> around <canvas />.",
      "Use shadcn components from /components/ui/*.jsx (not .tsx)."
    ],
    "css": [
      "Do not use global .App { text-align:center }.",
      "Do not use transition: all; only transition-colors/opacity/shadow where needed.",
      "Avoid heavy backdrop-blur; use solid panels with subtle inner highlight (1px) and shadow."
    ]
  },

  "instructions_to_main_agent": [
    "Replace default shadcn tokens in /app/frontend/src/index.css with the provided Night-Lab tokens (dark-first).",
    "Build the game screen layout as: full-screen canvas + fixed HUD regions (top bar, bottom-left build, right inspect) using solid panel backgrounds.",
    "Implement toolbars with shadcn Tabs + ToggleGroup; every tool button must have icon + label + tooltip and data-testid.",
    "Use sonner for alerts; create a special ‘breakthrough’ toast variant with cyan glow + scanline sweep (respect reduced motion).",
    "For canvas palette, implement the provided hex colors as a central JS palette object so renderer + UI overlays share semantics (selected/valid/invalid).",
    "Implement UNKNOWN/redacted fields using rose accent + hashed pattern blocks; keep danger (errors) separate in red."
  ],

  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
