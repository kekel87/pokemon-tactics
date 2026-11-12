"""Adapte les animations du gabarit dresseur (proportions de Red) à une autre carrure ; écrit un bloc `animations:`.

Les mains sont recalées sur la nouvelle épaule et leur écart à l'épaule allongé du rapport des bras ; pieds,
`root` et `bob` suivent le rapport des jambes. Le reste (rotations, tête) est gardé tel quel, ce qui préserve la
règle des images tenues (`lean` 0.05, `head_yaw = -twist`, `head_pitch` -0.08).
usage : python3 adapter_animations.py <gabarit.yaml> <personnage.yaml> > animations.yaml
Le personnage donne `bones.shoulder_L.pos`, `ik.arm_L.lengths` et `ik.leg_L.lengths` ; ce qui manque vient du gabarit.
"""
import sys

import yaml


def bone(spec, name, key, default):
    return spec.get("bones", {}).get(name, {}).get(key, default)


def chain(spec, name, default):
    return spec.get("ik", {}).get(name, {}).get("lengths", default)


def main():
    template = yaml.safe_load(open(sys.argv[1]))
    character = yaml.safe_load(open(sys.argv[2]))
    shoulder_template = bone(template, "shoulder_L", "pos", [0.185, 0.46, 0])
    shoulder = bone(character, "shoulder_L", "pos", shoulder_template)
    arm_ratio = sum(chain(character, "arm_L", chain(template, "arm_L", []))) / sum(chain(template, "arm_L", []))
    leg_ratio = sum(chain(character, "leg_L", chain(template, "leg_L", []))) / sum(chain(template, "leg_L", []))
    hip_template = bone(template, "hip_L", "pos", [0.095, -0.02, 0])[0]
    hip = bone(character, "hip_L", "pos", [hip_template])[0]

    def number(value):
        return float(f"{value:.3f}")

    def hand(value):
        if isinstance(value, list):
            return [number(shoulder[0] + arm_ratio * (value[0] - shoulder_template[0])),
                    number(shoulder[1] + arm_ratio * (value[1] - shoulder_template[1])), number(arm_ratio * value[2])]
        return (f"[{shoulder[0]}, {shoulder[1]}, 0] + {arm_ratio:.3f}*({value} - "
                f"[{shoulder_template[0]}, {shoulder_template[1]}, 0])")

    def foot(value):
        if isinstance(value, list):
            return [number(hip + 0.035 + (value[0] - hip_template - 0.035) * leg_ratio), number(value[1] * leg_ratio), number(value[2] * leg_ratio)]
        pivot = hip_template + 0.035
        return f"[{hip + 0.035 - leg_ratio * pivot:.3f}, 0, 0] + {leg_ratio:.3f}*({value})"

    def scaled(value):
        if isinstance(value, list):
            return [number(x * leg_ratio) for x in value]
        if isinstance(value, (int, float)):
            return number(value * leg_ratio)
        return f"{leg_ratio:.3f}*({value})"

    def adapt(channels):
        adapted = {}
        for name, value in channels.items():
            if name in ("hand_L", "hand_R"):
                adapted[name] = hand(value)
            elif name in ("foot_L", "foot_R"):
                adapted[name] = foot(value)
            elif name in ("root", "bob"):
                adapted[name] = scaled(value)
            else:
                adapted[name] = value
        return adapted

    animations = template["animations"]
    for clip in animations.values():
        for key in clip.get("keys", []):
            key["set"] = adapt(key["set"])
        if "channels" in clip:
            clip["channels"] = adapt(clip["channels"])
    print(yaml.safe_dump({"animations": animations}, sort_keys=False, allow_unicode=True, width=200))


if __name__ == "__main__":
    main()
