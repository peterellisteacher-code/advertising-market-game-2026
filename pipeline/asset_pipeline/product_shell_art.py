"""Safe, editable cel-shaded SVG for the product-shell style audition."""

from __future__ import annotations

from collections.abc import Callable, Iterable
from dataclasses import dataclass
from html import escape
from typing import Literal

from .product_shell_audition import Archetype, AuditionPrototype


INK = "#34414D"
DETAIL_INK = "#6A7580"
PAPER = "#F4F1EA"
GUIDE = "#6C5CE7"
OUTER_STROKE = 6
DETAIL_STROKE = 3

View = Literal["authoring", "preview", "review"]


@dataclass(frozen=True, slots=True)
class ArtworkSurface:
    path: str
    bounds: tuple[float, float, float, float]


@dataclass(frozen=True, slots=True)
class ArtGeometry:
    product_bounds: tuple[float, float, float, float]
    regions: dict[str, tuple[str, ...]]
    details: tuple[str, ...]
    shadow_plane: str
    highlight_plane: str
    surface: ArtworkSurface


def _region(name: str, fill: str, fragments: Iterable[str]) -> str:
    return (
        f'<g data-region="{escape(name)}" fill="{escape(fill)}">'
        f'{"".join(fragments)}</g>'
    )


def _corner_guides(x: float, y: float, width: float, height: float) -> str:
    length = min(width, height) * 0.085
    paths = (
        f"M{x + length} {y}H{x}V{y + length}",
        f"M{x + width - length} {y}H{x + width}V{y + length}",
        f"M{x} {y + height - length}V{y + height}H{x + length}",
        f"M{x + width} {y + height - length}V{y + height}H{x + width - length}",
    )
    return "".join(f'<path d="{path}"/>' for path in paths)


def _slim_can() -> ArtGeometry:
    body = (
        '<path d="M375 150H625Q665 150 665 190V810Q665 850 625 850H375'
        'Q335 850 335 810V190Q335 150 375 150Z"/>',
    )
    trim = (
        '<ellipse cx="500" cy="170" rx="165" ry="30"/>',
        '<path d="M340 805Q500 852 660 805V830Q500 882 340 830Z"/>',
    )
    accent = (
        '<path d="M342 215Q500 250 658 215V252Q500 282 342 252Z"/>',
    )
    label_path = "M340 230Q500 265 660 230V760Q500 792 340 760Z"
    return ArtGeometry(
        product_bounds=(335, 150, 330, 700),
        regions={
            "body": body,
            "trim": trim,
            "accent": accent,
            "label": (f'<path d="{label_path}"/>',),
        },
        details=(
            '<ellipse cx="500" cy="168" rx="132" ry="19"/>',
            '<path d="M455 167Q500 146 545 167Q500 187 455 167Z"/>',
            '<path d="M370 815Q500 845 630 815"/>',
        ),
        shadow_plane="M565 238Q650 230 660 230V760Q620 774 565 780Z",
        highlight_plane="M372 276Q408 260 426 276V704Q405 722 372 706Z",
        surface=ArtworkSurface(label_path, (340, 230, 320, 546)),
    )


def _sports_bottle() -> ArtGeometry:
    body_path = (
        "M390 205H610Q620 255 690 300Q730 330 730 390V790"
        "Q730 850 670 870H330Q270 850 270 790V390Q270 330 310 300"
        "Q380 255 390 205Z"
    )
    label_path = (
        "M270 300Q350 265 390 235H610Q650 265 730 300V840"
        "Q500 885 270 840Z"
    )
    return ArtGeometry(
        product_bounds=(270, 110, 460, 760),
        regions={
            "body": (f'<path d="{body_path}"/>',),
            "trim": (
                '<path d="M390 110H610Q630 110 630 132V205H370V132Q370 110 390 110Z"/>',
            ),
            "accent": (
                '<path d="M372 145H628V172H372Z"/>',
                '<path d="M280 410Q500 455 720 410V470Q500 510 280 470Z"/>',
            ),
            "label": (f'<path d="{label_path}"/>',),
        },
        details=(
            '<path d="M395 125V190M430 125V190M465 125V190M500 125V190M535 125V190M570 125V190M605 125V190"/>',
            '<path d="M305 355Q500 400 695 355"/>',
            '<path d="M310 785Q500 825 690 785"/>',
        ),
        shadow_plane="M610 238Q730 285 730 390V790Q730 850 670 870H590Z",
        highlight_plane="M330 330Q365 292 405 270L420 780Q380 815 330 792Z",
        surface=ArtworkSurface(label_path, (270, 235, 460, 628)),
    )


def _snack_pouch() -> ArtGeometry:
    body_path = (
        "M230 140H770L800 820Q742 860 680 842Q590 875 500 850"
        "Q410 875 320 842Q258 860 200 820Z"
    )
    label_path = (
        "M230 220Q500 244 770 220L790 790Q710 825 650 808"
        "Q500 840 350 808Q290 825 210 790Z"
    )
    return ArtGeometry(
        product_bounds=(200, 140, 600, 720),
        regions={
            "body": (f'<path d="{body_path}"/>',),
            "trim": (
                '<path d="M230 140H770L778 205Q500 230 222 205Z"/>',
                '<path d="M205 790Q500 842 795 790L800 820Q742 860 680 842Q590 875 500 850Q410 875 320 842Q258 860 200 820Z"/>',
            ),
            "accent": (
                '<path d="M230 205L282 830L210 805L200 820Z"/>',
                '<path d="M770 205L718 830L790 805L800 820Z"/>',
            ),
            "label": (f'<path d="{label_path}"/>',),
        },
        details=(
            '<path d="M242 172H758"/>',
            '<path d="M260 220L300 810M740 220L700 810"/>',
            '<path d="M340 824Q500 790 660 824"/>',
        ),
        shadow_plane="M670 214L770 205L800 820Q742 860 680 842L650 808Z",
        highlight_plane="M280 245Q325 230 365 236L390 770Q342 790 305 775Z",
        surface=ArtworkSurface(label_path, (210, 220, 580, 604)),
    )


def _takeaway_box() -> ArtGeometry:
    top_path = "M140 260L680 200L860 340L720 460L150 470Z"
    front_path = "M150 470L720 460L700 740L210 800Z"
    right_path = "M720 460L860 340L850 620L700 740Z"
    label_path = (
        "M140 260L680 200L860 340L720 460L150 470ZM150 470L720 460"
        "L700 740L210 800Z"
    )
    return ArtGeometry(
        product_bounds=(100, 200, 800, 600),
        regions={
            "body": (f'<path d="{front_path}"/>',),
            "trim": (f'<path d="{top_path}"/>',),
            "accent": (f'<path d="{right_path}"/>',),
            "label": (f'<path d="{label_path}" fill-opacity="0.42"/>',),
        },
        details=(
            '<path d="M150 470L720 460L860 340"/>',
            '<path d="M230 505L650 495L640 680L250 720Z"/>',
            '<path d="M225 290L650 242L770 332L690 405L255 412Z"/>',
            '<path d="M740 486L815 424L810 595L730 660"/>',
        ),
        shadow_plane=right_path,
        highlight_plane="M185 282L630 232L680 270L245 328Z",
        surface=ArtworkSurface(label_path, (140, 200, 720, 600)),
    )


def _hoodie() -> ArtGeometry:
    torso = "M315 270Q360 228 405 220H595Q640 228 685 270L748 820H252Z"
    sleeves = (
        '<path d="M315 270Q250 280 205 350L100 625L245 680L335 445Z"/>',
        '<path d="M685 270Q750 280 795 350L900 625L755 680L665 445Z"/>',
    )
    surface_path = (
        "M300 280Q355 250 410 250H590Q645 250 700 280L835 610"
        "L735 650L700 790H300L265 650L165 610Z"
    )
    return ArtGeometry(
        product_bounds=(80, 150, 840, 700),
        regions={
            "body": (f'<path d="{torso}"/>', *sleeves),
            "trim": (
                '<path d="M355 250Q330 155 500 150Q670 155 645 250Q585 315 500 325Q415 315 355 250Z"/>',
                '<path d="M252 780H748V840H252Z"/>',
                '<path d="M100 625L245 680L225 730L82 675Z"/>',
                '<path d="M900 625L755 680L775 730L918 675Z"/>',
            ),
            "accent": (
                '<path d="M350 610Q500 570 650 610L620 725H380Z"/>',
            ),
        },
        details=(
            '<path d="M440 265L420 455M560 265L580 455"/>',
            '<circle cx="418" cy="465" r="10"/><circle cx="582" cy="465" r="10"/>',
            '<path d="M380 680H620M500 585V725"/>',
            '<path d="M315 270L335 445M685 270L665 445"/>',
        ),
        shadow_plane="M590 220Q660 235 700 295L900 625L755 680L700 790H610Z",
        highlight_plane="M345 300Q385 268 425 258L390 575Q350 610 305 598Z",
        surface=ArtworkSurface(surface_path, (165, 250, 670, 540)),
    )


def _trainer() -> ArtGeometry:
    upper_path = (
        "M130 555Q210 510 285 400Q325 335 410 310L555 300"
        "Q625 382 680 450Q770 500 865 535Q900 550 900 600"
        "L865 655H160Q100 640 100 600Q100 570 130 555Z"
    )
    sole_path = (
        "M105 605Q135 640 180 645H870Q900 640 900 675Q900 720 850 735"
        "H175Q105 725 90 675Q85 635 105 605Z"
    )
    surface_path = (
        "M150 550Q230 500 300 405Q345 345 420 330L560 320"
        "Q630 410 690 470Q770 505 850 540L820 620H180Z"
    )
    return ArtGeometry(
        product_bounds=(90, 300, 810, 440),
        regions={
            "upper": (f'<path d="{upper_path}"/>',),
            "sole": (f'<path d="{sole_path}"/>',),
            "trim": (
                '<path d="M130 555Q210 510 285 400L330 510L250 625H145Z"/>',
                '<path d="M760 510Q835 530 890 565L870 630H775Z"/>',
            ),
            "accent": (
                '<path d="M390 330L555 300L640 420L545 520L350 495Z"/>',
            ),
        },
        details=(
            '<path d="M370 385L585 450M350 420L560 485M330 455L530 520"/>',
            '<path d="M430 340L350 505M480 325L400 520M530 315L455 525"/>',
            '<path d="M165 675H835"/>',
            '<path d="M710 490Q735 545 720 615"/>',
        ),
        shadow_plane="M690 470Q790 510 865 535Q900 550 900 600L865 655H720Z",
        highlight_plane="M205 522Q270 465 315 395Q350 355 405 340L390 392Q320 430 270 520Z",
        surface=ArtworkSurface(surface_path, (150, 320, 700, 300)),
    )


def _smartphone() -> ArtGeometry:
    body_path = (
        "M330 100H665Q710 100 725 145L755 800Q758 870 700 895H330"
        "Q275 895 270 840V160Q270 100 330 100Z"
    )
    screen_path = (
        "M330 150H650Q685 150 690 190L710 800Q712 840 675 850H345"
        "Q310 850 310 815V190Q310 150 330 150Z"
    )
    return ArtGeometry(
        product_bounds=(260, 100, 502, 800),
        regions={
            "body": (f'<path d="{body_path}"/>',),
            "screen": (f'<path d="{screen_path}"/>',),
            "trim": (
                '<path d="M725 145L755 800Q758 870 700 895L675 850Q712 840 710 800L690 190Q685 150 650 150L665 100Q710 100 725 145Z"/>',
            ),
            "accent": (
                '<path d="M430 122H570Q590 122 590 142H410Q410 122 430 122Z"/>',
                '<circle cx="655" cy="125" r="10"/>',
            ),
        },
        details=(
            '<path d="M752 270L760 390M756 430L762 510"/>',
            '<path d="M420 875H585"/>',
        ),
        shadow_plane="M665 100Q710 100 725 145L755 800Q758 870 700 895L675 850Q712 840 710 800L690 190Q685 150 650 150Z",
        highlight_plane="M332 180Q350 160 375 160V790Q365 815 335 820Z",
        surface=ArtworkSurface(screen_path, (310, 150, 402, 700)),
    )


def _headphones() -> ArtGeometry:
    headband = (
        "M198 505Q165 340 230 225Q315 92 500 130Q665 155 752 315"
        "Q790 380 800 485L720 500Q700 380 635 305Q570 230 470 220"
        "Q350 210 285 305Q240 375 270 500Z"
    )
    back_cup = (
        '<path d="M150 455Q165 385 235 365H330Q400 390 420 470V690Q395 770 320 790H225Q155 765 140 690Z"/>',
    )
    front_cup = (
        "M400 270Q520 225 675 260Q815 295 850 430V620Q820 750 690 780"
        "H475Q345 750 315 620V430Q330 325 400 270Z"
    )
    surface_path = (
        "M400 270Q520 225 675 260Q815 295 850 430V620Q820 750 690 780"
        "H475Q345 750 315 620V430Q330 325 400 270Z"
    )
    return ArtGeometry(
        product_bounds=(140, 125, 710, 705),
        regions={
            "body": (f'<path d="{headband}"/>', *back_cup),
            "trim": (f'<path d="{front_cup}"/>',),
            "accent": (
                '<path d="M425 335Q525 300 650 325Q755 350 780 455V595Q750 695 650 715H500Q400 690 380 595V455Q390 380 425 335Z"/>',
            ),
        },
        details=(
            '<path d="M250 480Q225 350 300 265Q375 180 490 190"/>',
            '<path d="M415 315Q535 270 675 305Q790 335 815 455V610"/>',
            '<path d="M445 385Q540 350 635 375Q715 398 730 480V575Q710 650 635 670H515Q440 650 425 575V480Q430 420 445 385Z"/>',
        ),
        shadow_plane="M150 455Q165 385 235 365H330Q400 390 420 470V690Q395 770 320 790H225Q155 765 140 690Z",
        highlight_plane="M420 305Q475 270 535 270L500 710Q430 680 405 610V430Q408 350 420 305Z",
        surface=ArtworkSurface(surface_path, (310, 240, 540, 540)),
    )


def _food_truck() -> ArtGeometry:
    side_path = "M120 300H720L760 355V750H120Z"
    front_path = "M720 300L890 395V720L760 750V355Z"
    surface_path = "M170 430H690L710 710L190 740Z"
    return ArtGeometry(
        product_bounds=(80, 270, 840, 560),
        regions={
            "body": (f'<path d="{side_path}"/>', f'<path d="{front_path}"/>'),
            "window": (
                '<path d="M245 345H635V535H245Z" fill-opacity="0.70"/>',
                '<path d="M775 390L855 432V545L775 530Z" fill-opacity="0.70"/>',
            ),
            "trim": (
                '<path d="M95 270H720L765 300L730 335H95Z"/>',
                '<circle cx="250" cy="760" r="70"/><circle cx="700" cy="760" r="70"/>',
                '<path d="M80 725H920V770H80Z"/>',
            ),
            "awning": (
                '<path d="M220 325H660L690 380H190Z"/>',
            ),
        },
        details=(
            '<path d="M245 535H635L660 565H220Z"/>',
            '<path d="M270 345V535M335 345V535M400 345V535M465 345V535M530 345V535M595 345V535"/>',
            '<circle cx="250" cy="760" r="32"/><circle cx="700" cy="760" r="32"/>',
            '<path d="M792 595L850 612"/>',
        ),
        shadow_plane=front_path,
        highlight_plane="M145 325H205V700H145Z",
        surface=ArtworkSurface(surface_path, (170, 430, 540, 310)),
    )


def _garden_tool() -> ArtGeometry:
    shaft_path = "M395 180Q395 145 435 140H565Q605 145 605 180V825H395Z"
    grip_path = (
        "M405 95Q405 70 435 70H565Q595 70 595 95V215Q595 235 570 235"
        "H430Q405 235 405 215Z"
    )
    head_path = "M420 755L575 730L610 775L705 830L665 895L545 850L465 815L400 835Z"
    surface_path = "M395 215Q395 195 415 195H585Q605 195 605 215V815H395Z"
    return ArtGeometry(
        product_bounds=(290, 70, 420, 830),
        regions={
            "body": (f'<path d="{shaft_path}"/>',),
            "handle": (f'<path d="{grip_path}"/>',),
            "accent": (
                f'<path data-product-part="angled-hoe-head" d="{head_path}"/>',
            ),
        },
        details=(
            '<path d="M440 100H560M440 135H560M440 170H560M440 205H560"/>',
            '<path d="M440 265V745M560 265V745"/>',
            '<path d="M575 775L685 838M555 815L665 875"/>',
        ),
        shadow_plane="M520 140H565Q605 145 605 180V800L705 830L665 895L545 850L520 840Z",
        highlight_plane="M430 250H465V730H430Z",
        surface=ArtworkSurface(surface_path, (395, 195, 210, 620)),
    )


def _aquarium() -> ArtGeometry:
    frame = (
        '<path d="M100 190H900V810H100ZM150 250V590H850V250Z" fill-rule="evenodd"/>',
    )
    glass = (
        '<path d="M150 250H850V610H150Z" fill-opacity="0.26"/>',
    )
    surface_path = "M140 530H860V800H140Z"
    return ArtGeometry(
        product_bounds=(90, 160, 820, 670),
        regions={
            "body": frame,
            "glass": glass,
            "trim": (
                '<path d="M90 180Q90 160 115 160H885Q910 160 910 180V245H90Z"/>',
                '<path d="M90 760H910V830H90Z"/>',
            ),
            "accent": (
                '<path d="M150 420Q250 395 350 420T550 420T750 420T850 420V600H150Z" fill-opacity="0.38"/>',
            ),
        },
        details=(
            '<path d="M195 285V380M235 285V350"/>',
            '<path d="M180 620Q250 575 320 620T460 620T600 620T740 620T850 620"/>',
            '<path d="M150 250H850V610H150Z"/>',
            '<path d="M170 785H830"/>',
        ),
        shadow_plane="M800 250H850V610H800ZM820 610H900V810H820Z",
        highlight_plane="M180 270H225V520H180Z",
        surface=ArtworkSurface(surface_path, (140, 530, 720, 270)),
    )


def _pet_shop() -> ArtGeometry:
    building = "M100 250L180 170H820L900 250V840H100Z"
    sign_path = "M130 210Q130 190 155 190H845Q870 190 870 210V470H130Z"
    return ArtGeometry(
        product_bounds=(80, 145, 840, 695),
        regions={
            "body": (f'<path d="{building}"/>',),
            "window": (
                '<path d="M155 540H365V785H155Z" fill-opacity="0.72"/>',
                '<path d="M635 540H845V785H635Z" fill-opacity="0.72"/>',
            ),
            "trim": (
                '<path d="M80 250L175 145H825L920 250H860L800 195H200L140 250Z"/>',
                '<path d="M395 525H605V840H395Z"/>',
                '<path d="M120 470H880L845 550H155Z"/>',
            ),
            "sign": (f'<path d="{sign_path}"/>',),
        },
        details=(
            '<path d="M235 470L210 550M330 470L305 550M425 470L400 550M520 470L495 550M615 470L590 550M710 470L685 550M805 470L780 550"/>',
            '<path d="M260 540V785M740 540V785M155 665H365M635 665H845"/>',
            '<path d="M500 525V840"/>',
            '<circle cx="565" cy="690" r="10"/>',
        ),
        shadow_plane="M800 195L900 250V840H790Z",
        highlight_plane="M160 275H205V800H160Z",
        surface=ArtworkSurface(sign_path, (130, 190, 740, 280)),
    )


GEOMETRY_BUILDERS: dict[Archetype, Callable[[], ArtGeometry]] = {
    "slim-can": _slim_can,
    "sports-bottle": _sports_bottle,
    "snack-pouch": _snack_pouch,
    "takeaway-box": _takeaway_box,
    "hoodie": _hoodie,
    "trainer": _trainer,
    "smartphone": _smartphone,
    "headphones": _headphones,
    "food-truck": _food_truck,
    "garden-tool": _garden_tool,
    "aquarium": _aquarium,
    "pet-shop": _pet_shop,
}


_FLAT_SKIN_SURFACES: dict[Archetype, ArtworkSurface] = {
    "slim-can": ArtworkSurface(
        "M160 210Q140 210 140 230V770Q140 790 160 790H840Q860 790 860 770"
        "V230Q860 210 840 210Z",
        (140, 210, 720, 580),
    ),
    "sports-bottle": ArtworkSurface(
        "M170 215Q150 215 150 235V765Q150 785 170 785H830Q850 785 850 765"
        "V235Q850 215 830 215Z",
        (150, 215, 700, 570),
    ),
    "snack-pouch": ArtworkSurface(
        "M160 200Q140 200 140 220V780Q140 800 160 800H840Q860 800 860 780"
        "V220Q860 200 840 200Z",
        (140, 200, 720, 600),
    ),
    "takeaway-box": ArtworkSurface(
        "M160 220Q140 220 140 240V760Q140 780 160 780H840Q860 780 860 760"
        "V240Q860 220 840 220Z",
        (140, 220, 720, 560),
    ),
}


def artwork_surface_for(archetype: Archetype) -> ArtworkSurface:
    """Return the exact product-face surface used to clip preview artwork."""

    return GEOMETRY_BUILDERS[archetype]().surface


def _flat_skin_regions(surface: ArtworkSurface) -> dict[str, tuple[str, ...]]:
    x, y, width, height = surface.bounds
    trim_height = height * 0.105
    accent_width = width * 0.09
    label_x = x + width * 0.13
    label_y = y + height * 0.17
    label_width = width * 0.74
    label_height = height * 0.66
    return {
        "body": (f'<path d="{surface.path}"/>',),
        "trim": (
            f'<path d="M{x} {y}H{x + width}V{y + trim_height}H{x}Z"/>',
            f'<path d="M{x} {y + height - trim_height}H{x + width}V{y + height}H{x}Z"/>',
        ),
        "accent": (
            f'<path d="M{x} {y + trim_height}H{x + accent_width}V{y + height - trim_height}H{x}Z"/>',
            f'<path d="M{x + width - accent_width} {y + trim_height}H{x + width}V{y + height - trim_height}H{x + width - accent_width}Z"/>',
        ),
        "label": (
            f'<path d="M{label_x} {label_y}H{label_x + label_width}V{label_y + label_height}H{label_x}Z"/>',
        ),
    }


def _semantic_regions(
    prototype: AuditionPrototype,
    geometry: ArtGeometry,
    surface: ArtworkSurface,
    use_flat_skin: bool,
) -> str:
    available = _flat_skin_regions(surface) if use_flat_skin else geometry.regions
    markup: list[str] = []
    for region in prototype.regions:
        fragments = available.get(region.id)
        if fragments is None:
            raise ValueError(
                f"{prototype.archetype} has no geometry for region {region.id}"
            )
        markup.append(_region(region.id, region.fill, fragments))
    return "".join(markup)


def _object_layers(geometry: ArtGeometry, regions: str) -> str:
    details = "".join(geometry.details)
    return (
        f'<g data-product-shell="true" stroke="{INK}" '
        f'stroke-width="{OUTER_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{regions}</g>'
        f'<path data-tone="shadow" fill="{INK}" opacity="0.10" '
        f'stroke="none" d="{geometry.shadow_plane}"/>'
        f'<path data-tone="highlight" fill="#FFFFFF" opacity="0.34" '
        f'stroke="none" d="{geometry.highlight_plane}"/>'
        f'<g data-detail-layer="true" fill="none" stroke="{DETAIL_INK}" '
        f'stroke-width="{DETAIL_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{details}</g>'
    )


def _flat_skin_layers(regions: str, surface: ArtworkSurface) -> str:
    x, y, width, height = surface.bounds
    seams = (
        f'<path d="M{x + width * 0.5} {y + height * 0.04}'
        f'V{y + height * 0.96}"/>'
        f'<path d="M{x + width * 0.04} {y + height * 0.5}'
        f'H{x + width * 0.96}"/>'
    )
    return (
        f'<g data-product-shell="flat-skin" stroke="{INK}" '
        f'stroke-width="{OUTER_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{regions}</g>'
        f'<g data-detail-layer="true" fill="none" stroke="{DETAIL_INK}" '
        f'stroke-width="{DETAIL_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{seams}</g>'
    )


def _grounding_shadow(bounds: tuple[float, float, float, float]) -> str:
    x, y, width, height = bounds
    center_x = x + width / 2
    center_y = min(y + height + 24, 930)
    radius_x = width * 0.42
    radius_y = max(13, height * 0.028)
    return (
        f'<ellipse data-grounding-shadow="true" cx="{center_x}" cy="{center_y}" '
        f'rx="{radius_x}" ry="{radius_y}" fill="{INK}" opacity="0.14"/>'
    )


def _clip_definition(clip_id: str, surface: ArtworkSurface) -> str:
    _, _, width, height = surface.bounds
    return (
        f'<defs><clipPath id="{escape(clip_id)}">'
        f'<path data-artwork-surface="primary" data-surface-width="{width}" '
        f'data-surface-height="{height}" d="{surface.path}"/>'
        "</clipPath></defs>"
    )


def _guide_overlay(view: View, surface: ArtworkSurface) -> str:
    if view == "preview":
        return ""
    visibility = "hidden" if view == "authoring" else "visible"
    opacity = "" if view == "authoring" else ' opacity="0.42"'
    x, y, width, height = surface.bounds
    return (
        f'<g data-guide-overlay="true" visibility="{visibility}"{opacity}>'
        f'<path data-print-area="primary" d="{surface.path}" fill="{GUIDE}" '
        'fill-opacity="0.10" stroke="none"/>'
        f'<g data-corner-guides="true" fill="none" stroke="{GUIDE}" '
        f'stroke-width="{DETAIL_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{_corner_guides(x, y, width, height)}</g>'
        "</g>"
    )


def render_audition_svg(prototype: AuditionPrototype, view: View) -> str:
    """Render one safe audition shell without external content or active markup."""

    if view not in ("authoring", "preview", "review"):
        raise ValueError(f"unsupported audition view: {view}")

    geometry = GEOMETRY_BUILDERS[prototype.archetype]()
    use_flat_skin = prototype.authoring_mode == "flat-skin" and view != "preview"
    surface = (
        _FLAT_SKIN_SURFACES[prototype.archetype]
        if use_flat_skin
        else geometry.surface
    )
    clip_id = f"{prototype.id}-primary-artwork-clip"
    regions = _semantic_regions(prototype, geometry, surface, use_flat_skin)
    layers = (
        _flat_skin_layers(regions, surface)
        if use_flat_skin
        else _object_layers(geometry, regions)
    )
    grounding = _grounding_shadow(geometry.product_bounds) if view == "preview" else ""
    artwork_slot = (
        f'<g data-artwork-slot="primary" clip-path="url(#{escape(clip_id)})"></g>'
    )

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" '
        f'data-shell-id="{escape(prototype.id)}" '
        f'data-authoring-mode="{escape(prototype.authoring_mode)}">'
        f'{_clip_definition(clip_id, surface)}{grounding}{layers}{artwork_slot}'
        f'{_guide_overlay(view, surface)}</svg>'
    )


__all__ = [
    "ArtGeometry",
    "ArtworkSurface",
    "DETAIL_INK",
    "DETAIL_STROKE",
    "GEOMETRY_BUILDERS",
    "GUIDE",
    "INK",
    "OUTER_STROKE",
    "PAPER",
    "artwork_surface_for",
    "render_audition_svg",
]
