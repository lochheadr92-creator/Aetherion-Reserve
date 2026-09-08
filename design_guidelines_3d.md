{
  "document": {
    "title": "ART DIRECTION & RENDERING BIBLE — Isometric Orthographic Alien Reserve (Three.js)",
    "scope": "3D world rendering only (terrain, water, flora, fences, paths, buildings, creatures, guests/staff, VFX, post). Existing React HUD tokens remain unchanged and sit above the WebGL viewport.",
    "camera_lock": {
      "projection": "orthographic",
      "iso": "2:1 dimetric",
      "yaw_deg": 45,
      "pitch_deg": 30,
      "perspective": "disabled",
      "tile_scale": "1 tile = 1 world unit",
      "height_step": "~0.255 world units",
      "readability_priority": "Gameplay readability > cinematic mood"
    },
    "success_criteria": [
      "No pixel art anywhere in world view; all surfaces are PBR-ish with baked textures.",
      "Planet Zoo / Jurassic World Evolution diorama feel from an orthographic iso camera.",
      "World harmonises with dark cyan/seaglass HUD without changing HUD tokens.",
      "60fps target at 1920x1080 on mid-range laptop GPU; graceful degradation tiers."
    ]
  },

  "1_overall_look_and_mood": {
    "visual_personality": {
      "keywords": [
        "cinematic diorama",
        "lush believable ecology",
        "clean sci-fi infrastructure",
        "alien bioluminescence",
        "high micro-detail at macro readability",
        "filmic contrast with controlled saturation"
      ],
      "composition_rules_for_iso": [
        "Treat each enclosure like a miniature set: strong ground material separation, readable paths, and clear fence silhouettes.",
        "Avoid noisy micro-contrast on large ground planes; reserve high-frequency detail for edges, cliffs, props, and close-up photo mode.",
        "Use value grouping: ground mid-values, entities slightly brighter/darker with rim/outline cues so silhouettes pop under ortho.",
        "Alien materials (fungal/aether) should read as ‘special’ via hue shift + subtle emissive speckle, not via heavy glow everywhere."
      ],
      "harmonise_with_hud": {
        "hud_tokens_reference": {
          "accent_cyan": "#2DE2E6",
          "hover": "#8AA4FF",
          "valid": "#3EE28A",
          "invalid": "#FF4D6D",
          "blueprint": "#4DB6FF"
        },
        "world_color_strategy": [
          "Keep the world’s dominant neutrals in cool-warm balance (stone/soil warm, foliage cool) so HUD cyan remains the sharpest chroma accent.",
          "Reserve saturated cyan/teal for diegetic tech (energy fences, signage, lab lights) but keep it 20–40% less saturated than HUD accent.",
          "Alien bioluminescence uses violet/sea-glass hues but at low area coverage; never compete with HUD overlays."
        ]
      }
    },
    "macro_palette_targets": {
      "ground_neutrals": ["warm gray", "olive gray", "cool slate"],
      "foliage": ["deep pine", "sage", "wet emerald"],
      "alien_biome": ["violet-black", "seaglass", "cold azure"],
      "infrastructure": ["dark steel", "concrete", "glass", "hazard accents"]
    }
  },

  "2_lighting_design": {
    "global_principles": [
      "Lighting must preserve tile readability: avoid extreme low-angle shadows that smear across tiles.",
      "Keep a mostly fixed key direction aligned with iso yaw for consistent shadow language; vary color/intensity across day phases.",
      "Use hemisphere/ambient to prevent crushed blacks under ortho; rely on AO + contact shadows for grounding."
    ],
    "sun_moon_direction": {
      "key_light_direction": {
        "azimuth_deg": 315,
        "elevation_deg": 55,
        "note": "Azimuth chosen so shadows fall down-right relative to camera, reinforcing depth without hiding UI markers."
      },
      "moon_direction": {
        "azimuth_deg": 135,
        "elevation_deg": 45,
        "note": "Opposes sun for intuitive day/night; keep shadows softer at night."
      }
    },
    "day_phases": {
      "dawn": {
        "key_temp_kelvin": 4200,
        "key_intensity": 0.85,
        "fill_temp_kelvin": 6500,
        "fill_intensity": 0.55,
        "sky_color": "#BFD6E6",
        "ground_bounce": "#6B6A5E",
        "fog": {
          "enabled": true,
          "color": "#A9B8C6",
          "density": 0.012,
          "height_falloff": 0.18
        },
        "shadow": {
          "softness": "medium",
          "opacity": 0.55
        }
      },
      "day": {
        "key_temp_kelvin": 5600,
        "key_intensity": 1.15,
        "fill_temp_kelvin": 7000,
        "fill_intensity": 0.65,
        "sky_color": "#CFE6FF",
        "ground_bounce": "#7A6F5E",
        "fog": {
          "enabled": true,
          "color": "#C9D8E6",
          "density": 0.008,
          "height_falloff": 0.14
        },
        "shadow": {
          "softness": "medium-soft",
          "opacity": 0.6
        }
      },
      "dusk": {
        "key_temp_kelvin": 3600,
        "key_intensity": 0.9,
        "fill_temp_kelvin": 5200,
        "fill_intensity": 0.5,
        "sky_color": "#9FB2C9",
        "ground_bounce": "#5E5A52",
        "fog": {
          "enabled": true,
          "color": "#7E8FA6",
          "density": 0.014,
          "height_falloff": 0.2
        },
        "shadow": {
          "softness": "soft",
          "opacity": 0.5
        },
        "emissives": {
          "buildings": "start ramping up",
          "alien_flora": "visible but not blooming",
          "fences": "energy tiers become readable"
        }
      },
      "night": {
        "key_temp_kelvin": 9000,
        "key_intensity": 0.35,
        "fill_temp_kelvin": 11000,
        "fill_intensity": 0.35,
        "sky_color": "#1B2A3A",
        "ground_bounce": "#0E141A",
        "fog": {
          "enabled": true,
          "color": "#0F1C26",
          "density": 0.02,
          "height_falloff": 0.22
        },
        "shadow": {
          "softness": "very soft",
          "opacity": 0.35
        },
        "night_emissives": {
          "buildings": {
            "window_emissive": "#A7F3FF",
            "signage_emissive": "#7FE7FF",
            "warning_emissive": "#FFB86B"
          },
          "alien_flora": {
            "spore_pillar": "#B58CFF",
            "aether_frond": "#7FFFE1"
          },
          "insulated_fences": {
            "energy_field": "#6FEAFF"
          }
        }
      }
    },
    "weather_variants": {
      "overcast": {
        "key_intensity_multiplier": 0.75,
        "shadow_opacity_multiplier": 0.55,
        "sky_color": "#B9C7D3",
        "fog_density_multiplier": 1.25,
        "note": "Flatten contrast slightly; rely on AO/contact shadows for grounding."
      },
      "rain": {
        "key_intensity_multiplier": 0.7,
        "specular_boost": "increase clearcoat-like highlights on wet materials",
        "puddle_mask": "use low-frequency noise mask per tile",
        "fog_density_multiplier": 1.35,
        "rain_streaks": "screen-space subtle; avoid heavy particles that obscure tiles"
      },
      "storm": {
        "key_intensity_multiplier": 0.55,
        "sky_color": "#6E7F8F",
        "lightning": {
          "duration_ms": 120,
          "peak_intensity_multiplier": 2.2,
          "color": "#EAF6FF",
          "cooldown_s": "6–18 random"
        },
        "wind_multiplier": 1.8
      }
    },
    "bloom_thresholds": {
      "rule": "Bloom only for emissive tech + bioluminescence; never bloom sunlit whites.",
      "threshold": 1.05,
      "strength": 0.35,
      "radius": 0.55,
      "night_strength_multiplier": 1.25
    }
  },

  "3_material_pbr_palette_and_ai_texture_prompts": {
    "texture_authoring_rules": {
      "capture": [
        "Photoreal, seamless/tileable, neutral lighting, no cast shadows, no strong directional highlights.",
        "For ground: top-down (90°) view; for walls/fences/buildings: straight-on orthographic.",
        "Avoid recognizable objects/logos/text; avoid repeating obvious motifs.",
        "Deliver albedo (sRGB), normal (tangent), roughness (linear). Metalness mostly constant maps or scalar."
      ],
      "tile_resolution_budget": {
        "albedo_max": 1024,
        "normal_max": 512,
        "roughness_max": 512,
        "ao_optional": 512
      },
      "normal_strength_guidance": "Use subtle normals for large planes (0.35–0.6). Strong normals only for cliffs/rocks (0.8–1.1).",
      "repeat_guidance": "Texture scale is expressed as repeats per tile (1 tile = 1 world unit)."
    },

    "ground_materials_11": {
      "grassland": {
        "albedo_hex": "#5E7A4B",
        "roughness": 0.92,
        "metalness": 0.0,
        "normal_strength": 0.45,
        "repeat_per_tile": 1.6,
        "ai_prompt": "Seamless tileable photoreal grassland ground texture, top-down 90 degree view, mixed short grass and sparse dry patches, neutral overcast lighting, no shadows, no stones larger than a coin, high detail, PBR albedo only"
      },
      "dense_grass": {
        "albedo_hex": "#3F6B3E",
        "roughness": 0.9,
        "metalness": 0.0,
        "normal_strength": 0.55,
        "repeat_per_tile": 1.3,
        "ai_prompt": "Seamless tileable photoreal dense grass ground texture, top-down view, thick blades and clumps, subtle color variation, neutral lighting, no shadows, PBR albedo only"
      },
      "soil": {
        "albedo_hex": "#6A4E3A",
        "roughness": 0.95,
        "metalness": 0.0,
        "normal_strength": 0.5,
        "repeat_per_tile": 1.8,
        "ai_prompt": "Seamless tileable photoreal soil dirt ground texture, top-down view, fine granular earth with small pebbles, neutral lighting, no shadows, no footprints, PBR albedo only"
      },
      "sand": {
        "albedo_hex": "#C7B08A",
        "roughness": 0.98,
        "metalness": 0.0,
        "normal_strength": 0.35,
        "repeat_per_tile": 2.2,
        "ai_prompt": "Seamless tileable photoreal sand ground texture, top-down view, fine sand with subtle ripples, neutral lighting, no shadows, no shells, PBR albedo only"
      },
      "rock": {
        "albedo_hex": "#7A7F86",
        "roughness": 0.78,
        "metalness": 0.0,
        "normal_strength": 0.95,
        "repeat_per_tile": 1.2,
        "ai_prompt": "Seamless tileable photoreal rocky ground texture, top-down view, small stones and fractured rock, neutral lighting, no shadows, PBR albedo only"
      },
      "gravel": {
        "albedo_hex": "#8A8176",
        "roughness": 0.88,
        "metalness": 0.0,
        "normal_strength": 0.75,
        "repeat_per_tile": 1.7,
        "ai_prompt": "Seamless tileable photoreal gravel ground texture, top-down view, mixed small gravel stones, neutral lighting, no shadows, PBR albedo only"
      },
      "mud": {
        "albedo_hex": "#4B3A2F",
        "roughness": 0.97,
        "metalness": 0.0,
        "normal_strength": 0.55,
        "repeat_per_tile": 1.9,
        "ai_prompt": "Seamless tileable photoreal mud ground texture, top-down view, wet muddy earth with subtle puddle sheen but no directional highlights, neutral lighting, no shadows, PBR albedo only"
      },
      "wetland": {
        "albedo_hex": "#3E4F46",
        "roughness": 0.93,
        "metalness": 0.0,
        "normal_strength": 0.5,
        "repeat_per_tile": 1.6,
        "ai_prompt": "Seamless tileable photoreal wetland ground texture, top-down view, dark damp soil with mossy bits and tiny reeds debris, neutral lighting, no shadows, PBR albedo only"
      },
      "mossbed": {
        "albedo_hex": "#4F6E5A",
        "roughness": 0.9,
        "metalness": 0.0,
        "normal_strength": 0.6,
        "repeat_per_tile": 1.4,
        "ai_prompt": "Seamless tileable photoreal moss ground texture, top-down view, dense moss carpet with subtle variation, neutral lighting, no shadows, PBR albedo only"
      },
      "fungal_ground_alien_violet": {
        "albedo_hex": "#3A2B45",
        "roughness": 0.86,
        "metalness": 0.0,
        "normal_strength": 0.65,
        "repeat_per_tile": 1.5,
        "emissive_speckle": {
          "color": "#B58CFF",
          "intensity": 0.25,
          "coverage": 0.08
        },
        "ai_prompt": "Seamless tileable photoreal alien fungal ground texture, top-down view, dark violet-black organic mat with subtle fibrous patterns and tiny bioluminescent specks, neutral lighting, no shadows, PBR albedo only"
      },
      "aetheric_soil_alien_blue": {
        "albedo_hex": "#1F3E4F",
        "roughness": 0.84,
        "metalness": 0.0,
        "normal_strength": 0.6,
        "repeat_per_tile": 1.6,
        "emissive_veins": {
          "color": "#7FFFE1",
          "intensity": 0.22,
          "coverage": 0.06
        },
        "ai_prompt": "Seamless tileable photoreal alien aetheric soil texture, top-down view, deep blue-green mineral soil with faint glowing seaglass veins, neutral lighting, no shadows, PBR albedo only"
      }
    },

    "paths": {
      "packed_dirt_path": {
        "albedo_hex": "#7A5B43",
        "roughness": 0.94,
        "metalness": 0.0,
        "normal_strength": 0.45,
        "repeat_per_tile": 2.0,
        "ai_prompt": "Seamless tileable photoreal packed dirt path texture, top-down view, compacted earth with fine gravel, neutral lighting, no shadows, PBR albedo only"
      },
      "gravel_path": {
        "albedo_hex": "#8E857B",
        "roughness": 0.9,
        "metalness": 0.0,
        "normal_strength": 0.7,
        "repeat_per_tile": 1.8,
        "ai_prompt": "Seamless tileable photoreal gravel path texture, top-down view, small stones compacted, neutral lighting, no shadows, PBR albedo only"
      },
      "paved_service_path": {
        "albedo_hex": "#5F666E",
        "roughness": 0.72,
        "metalness": 0.0,
        "normal_strength": 0.55,
        "repeat_per_tile": 2.4,
        "ai_prompt": "Seamless tileable photoreal concrete paver path texture, top-down view, subtle seams and wear, neutral lighting, no shadows, no text, PBR albedo only"
      }
    },

    "cliffs_and_edges": {
      "cliff_rock": {
        "albedo_hex": "#6E737A",
        "roughness": 0.8,
        "metalness": 0.0,
        "normal_strength": 1.05,
        "repeat_per_tile": 1.0,
        "ai_prompt": "Seamless tileable photoreal cliff rock texture, straight-on view, layered sediment rock with cracks, neutral lighting, no shadows, PBR albedo only"
      },
      "cliff_soil": {
        "albedo_hex": "#6A4F3E",
        "roughness": 0.9,
        "metalness": 0.0,
        "normal_strength": 0.85,
        "repeat_per_tile": 1.2,
        "ai_prompt": "Seamless tileable photoreal soil cliff texture, straight-on view, compacted earth strata with roots hints, neutral lighting, no shadows, PBR albedo only"
      }
    },

    "water": {
      "shallow": {
        "base_color_hex": "#2E6B6A",
        "roughness": 0.18,
        "metalness": 0.0,
        "normal_strength": 0.35,
        "fresnel": {
          "power": 4.0,
          "edge_tint": "#A7F3FF"
        },
        "foam": {
          "color": "#D7F6FF",
          "opacity": 0.35,
          "shoreline_width": "0.08–0.14 tile"
        },
        "animation": {
          "normal_scroll_speed": "0.015–0.03 units/s",
          "secondary_normal_scale": 0.6
        }
      },
      "deep": {
        "base_color_hex": "#123A4A",
        "roughness": 0.12,
        "metalness": 0.0,
        "normal_strength": 0.45,
        "fresnel": {
          "power": 5.0,
          "edge_tint": "#7FE7FF"
        },
        "depth_fade": {
          "near": "#2B6E7A",
          "far": "#0B1F2A"
        },
        "animation": {
          "normal_scroll_speed": "0.01–0.02 units/s"
        }
      },
      "ai_prompt_for_water_normal": "Seamless tileable water normal map reference, small ripples, no directional waves, neutral pattern, suitable for game water"
    },

    "flora": {
      "bark": {
        "albedo_hex": "#5A4A3F",
        "roughness": 0.88,
        "metalness": 0.0,
        "normal_strength": 0.9,
        "repeat_per_tile": 2.0,
        "ai_prompt": "Seamless tileable photoreal tree bark texture, straight-on view, neutral lighting, no shadows, PBR albedo only"
      },
      "leaves": {
        "albedo_hex": "#3F6F4A",
        "roughness": 0.72,
        "metalness": 0.0,
        "normal_strength": 0.55,
        "repeat_per_tile": 2.6,
        "ai_prompt": "Seamless tileable photoreal leaf canopy texture, top-down view, mixed leaves, neutral lighting, no shadows, PBR albedo only"
      },
      "bioluminescent_violet": {
        "emissive_hex": "#B58CFF",
        "emissive_intensity": 0.6,
        "bloom_safe": true
      },
      "bioluminescent_seaglass": {
        "emissive_hex": "#7FFFE1",
        "emissive_intensity": 0.55,
        "bloom_safe": true
      }
    },

    "fences": {
      "basic": {
        "material": "galvanized steel + painted posts",
        "albedo_hex": "#6B737A",
        "roughness": 0.55,
        "metalness": 0.85,
        "normal_strength": 0.6,
        "ai_prompt": "Seamless tileable photoreal galvanized steel texture, straight-on view, neutral lighting, no shadows, no rust blobs, PBR albedo only"
      },
      "reinforced": {
        "material": "dark steel + bolts",
        "albedo_hex": "#3E454D",
        "roughness": 0.48,
        "metalness": 0.9,
        "normal_strength": 0.75,
        "ai_prompt": "Seamless tileable photoreal dark steel industrial texture, straight-on view, subtle wear, neutral lighting, no shadows, PBR albedo only"
      },
      "heavy_containment": {
        "material": "concrete base + steel mesh",
        "concrete_albedo_hex": "#7B7F84",
        "concrete_roughness": 0.85,
        "steel_albedo_hex": "#4A525A",
        "steel_roughness": 0.55,
        "steel_metalness": 0.9,
        "ai_prompt_concrete": "Seamless tileable photoreal concrete texture, straight-on view, subtle pores, neutral lighting, no shadows, PBR albedo only",
        "ai_prompt_mesh": "Seamless tileable photoreal steel mesh texture, straight-on view, neutral lighting, no shadows, PBR albedo only"
      },
      "insulated_energy_containment": {
        "material": "dark composite posts + energy field",
        "post_albedo_hex": "#2B3138",
        "post_roughness": 0.62,
        "post_metalness": 0.25,
        "energy_field": {
          "color": "#6FEAFF",
          "opacity": 0.22,
          "fresnel_power": 3.5,
          "scanline_speed": "0.35–0.6 cycles/s",
          "noise_warp": "subtle"
        }
      },
      "damage_states": {
        "scrape_albedo_shift": "+6% brightness, -8% saturation",
        "sparks_emissive": "#FFD08A",
        "breach_edge_highlight": "use UI invalid #FF4D6D as overlay outline only"
      }
    },

    "buildings": {
      "concrete": {
        "albedo_hex": "#7C8086",
        "roughness": 0.86,
        "metalness": 0.0,
        "normal_strength": 0.65,
        "repeat_per_tile": 2.2,
        "ai_prompt": "Seamless tileable photoreal architectural concrete texture, straight-on view, neutral lighting, no shadows, no graffiti, PBR albedo only"
      },
      "dark_steel": {
        "albedo_hex": "#2F353C",
        "roughness": 0.5,
        "metalness": 0.92,
        "normal_strength": 0.55,
        "repeat_per_tile": 3.0,
        "ai_prompt": "Seamless tileable photoreal dark brushed steel texture, straight-on view, neutral lighting, no shadows, PBR albedo only"
      },
      "glass": {
        "tint_hex": "#A7F3FF",
        "roughness": 0.08,
        "metalness": 0.0,
        "ior": 1.45,
        "note": "Prefer fake refraction via envMap + fresnel; keep transparency moderate for performance."
      },
      "roofing": {
        "albedo_hex": "#4B4F55",
        "roughness": 0.78,
        "metalness": 0.15,
        "normal_strength": 0.6,
        "repeat_per_tile": 2.8,
        "ai_prompt": "Seamless tileable photoreal industrial roofing texture, straight-on view, neutral lighting, no shadows, PBR albedo only"
      },
      "signage_lights": {
        "primary_emissive": "#7FE7FF",
        "secondary_emissive": "#FFB86B",
        "bloom_safe": true
      }
    }
  },

  "4_creature_material_language": {
    "global_rules": [
      "Creatures must read as silhouettes first: keep body albedo mid-range; reserve high contrast for accents and eyes.",
      "Map species colors consistently: colors.body -> base albedo tint; colors.accent -> secondary pattern/plates; colors.glow -> emissive accents only.",
      "Juveniles: slightly higher roughness (+0.06) and softer normals (-0.1 strength) to feel less armored; slightly larger eye highlight.",
      "Distress/injury readability: use desaturation + subtle darkening + localized emissive ‘warning’ suppression; never rely on gore."
    ],
    "body_plan_presets": {
      "scaled_hide": {
        "roughness": 0.62,
        "metalness": 0.0,
        "normal_strength": 0.75,
        "specular": "tight but not wet",
        "subsurface_trick": "fake SSS via wrap lighting: add small backlight rim and slightly warm underside",
        "eye_treatment": "glossy cornea (roughness 0.05), dark limbal ring, small emissive iris optional"
      },
      "leathery_skin": {
        "roughness": 0.72,
        "metalness": 0.0,
        "normal_strength": 0.55,
        "micro_detail": "fine pores via detail normal",
        "subsurface_trick": "thin rim light + slightly reddish scatter on ears/edges"
      },
      "chitin": {
        "roughness": 0.38,
        "metalness": 0.05,
        "normal_strength": 0.85,
        "clearcoat_like": "simulate with second specular lobe if available; otherwise lower roughness on edges",
        "accent": "edge wear brightening + subtle iridescent tint (very low)"
      },
      "crystal_lithomorph": {
        "roughness": 0.18,
        "metalness": 0.0,
        "normal_strength": 0.95,
        "transmission_fake": "use envMap + fresnel + internal emissive veins",
        "glow_mapping": "colors.glow drives emissive veins; clamp bloom"
      },
      "translucent_gel_blob": {
        "roughness": 0.22,
        "metalness": 0.0,
        "normal_strength": 0.35,
        "transmission_fake": "dithered alpha + fresnel rim; avoid true refraction",
        "internal_motion": "scrolling noise in emissive/opacity at 0.08–0.12 cycles/s"
      },
      "membrane_wings": {
        "roughness": 0.55,
        "metalness": 0.0,
        "normal_strength": 0.4,
        "thin_surface": "backface slightly brighter; subtle vein normal",
        "glow": "only at joints/edges"
      }
    },
    "color_morph_tinting": {
      "method": "Apply HSV shift to base albedo tint only; keep roughness/normal constant so morphs remain believable.",
      "limits": {
        "hue_shift_deg": "±25",
        "sat_multiplier": "0.85–1.15",
        "value_multiplier": "0.9–1.1"
      }
    },
    "distress_states": {
      "stressed": {
        "albedo": "-8% saturation, -4% value",
        "glow": "reduce emissive intensity by 35%",
        "overlay": "optional subtle pulsing outline using UI rose tint (see readability section)"
      },
      "injured": {
        "albedo": "localized dark bruising mask",
        "specular": "slightly higher roughness (+0.05)",
        "vfx": "sparks for mechanical/energy species only"
      }
    }
  },

  "5_post_processing_and_color_grading": {
    "tone_mapping": {
      "recommended": "ACESFilmic",
      "exposure": {
        "day": 1.0,
        "dawn": 0.95,
        "dusk": 0.9,
        "night": 0.75
      }
    },
    "grade_targets": {
      "contrast": "moderate-high (avoid crushed blacks under HUD)",
      "saturation": "slightly restrained; alien emissives provide color pops",
      "lift_gamma_gain": {
        "lift": "slightly cool",
        "gamma": "neutral",
        "gain": "slightly warm in day, cool in night"
      },
      "vignette": {
        "enabled": true,
        "strength": 0.18,
        "note": "Keep subtle so it doesn’t fight HUD edges."
      }
    },
    "ssao": {
      "enabled": true,
      "radius": 0.35,
      "intensity": 0.55,
      "quality": "medium",
      "note": "AO is key for ortho depth; keep stable (avoid temporal shimmer)."
    },
    "bloom": {
      "enabled": true,
      "threshold": 1.05,
      "strength": 0.35,
      "radius": 0.55
    },
    "anti_aliasing": {
      "preferred": "SMAA (post) or FXAA (fallback)",
      "note": "MSAA in WebGL2 can be expensive with post; choose based on tier."
    },
    "photo_mode_variant": {
      "depth_of_field": {
        "enabled": true,
        "focus_distance": "user-controlled",
        "bokeh": "subtle",
        "note": "DoF must not break gameplay; only in photo mode."
      },
      "grade": {
        "exposure": "+0.05",
        "contrast": "+0.08",
        "saturation": "+0.06",
        "bloom_strength": "+0.15",
        "vignette_strength": "+0.06"
      }
    }
  },

  "6_motion_language": {
    "global_rules": [
      "Motion supports life and readability; avoid constant high-frequency movement that makes selection markers hard to track.",
      "Respect prefers-reduced-motion: reduce wind amplitude, disable camera shake, reduce flicker frequency."
    ],
    "wind_on_flora": {
      "tall_grass": {"amplitude": 0.06, "frequency_hz": 0.35},
      "shrubs": {"amplitude": 0.035, "frequency_hz": 0.25},
      "canopy_trees": {"amplitude": 0.02, "frequency_hz": 0.18},
      "reeds": {"amplitude": 0.08, "frequency_hz": 0.4},
      "spore_pillar": {"amplitude": 0.015, "frequency_hz": 0.12, "note": "slow breathing sway"},
      "aether_frond": {"amplitude": 0.045, "frequency_hz": 0.22}
    },
    "water": {
      "shore_lap": {"speed": 0.25, "amplitude": 0.03},
      "deep_swell": {"speed": 0.12, "amplitude": 0.02},
      "foam_pulse": {"speed": 0.18, "amplitude": 0.04}
    },
    "creature_cadence": {
      "quadruped": {"walk_mps": 1.2, "idle_breath_s": 3.8},
      "tall_strider": {"walk_mps": 1.0, "idle_shift_s": 5.2},
      "winged": {"walk_mps": 1.1, "idle_wing_flick_s": 6.0, "flight_flap_hz": 1.6},
      "blob": {"glide_mps": 0.85, "idle_pulse_s": 4.5},
      "insect": {"walk_mps": 1.35, "idle_antenna_s": 2.8},
      "amphibian": {"walk_mps": 0.95, "idle_throat_s": 3.2},
      "serpent": {"slither_mps": 1.05, "idle_coil_s": 5.8},
      "floating_filter_feeder": {"drift_mps": 0.6, "idle_bob_s": 6.5}
    },
    "guests_staff": {
      "walk_mps": 1.25,
      "idle_lookaround_s": 7.0,
      "group_spacing": "0.35–0.6 units"
    },
    "events": {
      "breach_camera_shake": {
        "duration_ms": 420,
        "amplitude_px": 6,
        "frequency_hz": 10,
        "note": "Apply to render transform only; do not affect picking math."
      },
      "night_light_flicker": {
        "enabled": true,
        "chance_per_minute": 0.6,
        "duration_ms": "80–160",
        "intensity_drop": 0.25
      }
    }
  },

  "7_readability_rules_iso_ortho": {
    "contrast_and_silhouette": [
      "Ground materials must stay within a mid-value band; avoid near-black ground except small alien patches.",
      "Creatures should be 8–15% brighter or darker than the ground they commonly occupy.",
      "Use subtle rim lighting (cool at night, warm at day) to separate silhouettes without looking toon."
    ],
    "selection_and_hover": {
      "outline_colors_from_ui_tokens": {
        "hover": "#8AA4FF",
        "valid": "#3EE28A",
        "invalid": "#FF4D6D",
        "blueprint": "#4DB6FF",
        "accent_cyan": "#2DE2E6"
      },
      "rules": [
        "Outlines are screen-space and constant thickness (1.5–2.5px) so they remain readable across zoom.",
        "Never use bloom on outlines; keep them crisp.",
        "When on alien violet ground, increase outline brightness by +10% to avoid hue clash."
      ]
    },
    "tension_overlay": {
      "distress_markers": {
        "tint": "rose",
        "recommended_hex": "#FF4D6D",
        "opacity": 0.22,
        "pulse": {"period_s": 1.6, "amplitude": 0.12}
      },
      "breach_gaps": {
        "edge_highlight": "#FF4D6D",
        "fill": "#FF4D6D",
        "fill_opacity": 0.12
      }
    },
    "entity_vs_ground_rules": {
      "avoid": [
        "Highly detailed ground normals under small creatures (causes shimmer and silhouette loss).",
        "Overly saturated alien ground under similarly colored creatures."
      ],
      "do": [
        "Add a subtle contact shadow blob under creatures/props (screen-space or projected) for grounding.",
        "Use hue separation: if ground is violet, creature body should skew toward neutral/green/blue-gray; reserve violet for accents only."
      ]
    }
  },

  "8_performance_budget_guidance": {
    "targets": {
      "fps": 60,
      "resolution": "1920x1080",
      "hardware": "mid-range laptop GPU",
      "scene": "72x72 tiles + entities"
    },
    "shadow_budget": {
      "directional_shadow_map": {
        "high": 2048,
        "medium": 1536,
        "low": 1024
      },
      "cascades": "avoid cascades; use single ortho shadow frustum tuned to camera bounds",
      "soft_shadows": "PCF soft; reduce samples on low tier"
    },
    "instancing": {
      "must_instance": [
        "ground tiles by material",
        "flora clusters",
        "fence segments",
        "path segments",
        "small props"
      ],
      "creatures": "use shared geometries per body plan; morph via uniforms/colors"
    },
    "texture_budget": {
      "max_sizes": {
        "albedo": 1024,
        "normal": 512,
        "roughness": 512
      },
      "compression": "Use KTX2/Basis if available; otherwise keep JPG/PNG sizes tight.",
      "mipmaps": "enabled for all repeating textures; anisotropy 2–4 (high), 1–2 (medium), 0–1 (low)"
    },
    "quality_tiers": {
      "high": {
        "post": ["ACES", "SMAA", "SSAO medium", "Bloom"],
        "shadows": "2048",
        "fog": "enabled",
        "water": "dual normal scroll + foam",
        "flora_wind": "full"
      },
      "medium": {
        "post": ["ACES", "FXAA", "SSAO low", "Bloom reduced"],
        "shadows": "1536",
        "fog": "enabled (lower density)",
        "water": "single normal scroll",
        "flora_wind": "reduced amplitude"
      },
      "low": {
        "post": ["basic tone mapping", "FXAA"],
        "shadows": "1024 or blob shadows only",
        "fog": "optional off",
        "water": "static normal",
        "flora_wind": "off or minimal",
        "drop_first": [
          "SSAO",
          "DoF/photo mode extras",
          "bloom",
          "high anisotropy",
          "secondary normals",
          "dynamic lightning"
        ]
      }
    }
  },

  "implementation_notes_three_js": {
    "renderer": {
      "color_space": "SRGBColorSpace",
      "physically_correct_lights": true,
      "tone_mapping": "ACESFilmicToneMapping",
      "shadow_map": "PCFSoftShadowMap"
    },
    "post_stack_suggestion": [
      "EffectComposer",
      "RenderPass",
      "SSAO (or SAO)",
      "Bloom",
      "SMAA/FXAA"
    ],
    "orthographic_shadow_frustum": "Match to camera bounds + margin; update on zoom changes only.",
    "picking_constraint": "Do not alter camera math used by existing 2D picking; any camera shake must be visual-only."
  }
}
