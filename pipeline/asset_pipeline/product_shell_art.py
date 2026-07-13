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


@dataclass(frozen=True, slots=True)
class FlatSkinGeometry:
    surface: ArtworkSurface
    regions: dict[str, tuple[str, ...]]
    details: tuple[str, ...]
    mapping_target: str


FlatSkinBuilder = Callable[[], FlatSkinGeometry]


def flat_skin_geometry_for(archetype: Archetype) -> FlatSkinGeometry:
    try:
        builder = FLAT_SKIN_BUILDERS[archetype]
    except KeyError as error:
        raise ValueError(f"{archetype} does not use flat-skin authoring") from error
    return builder()


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
    torso = "M315 270Q360 228 405 220H595Q640 228 685 270L765 840H235Z"
    sleeves = (
        '<path d="M315 270Q250 280 205 350L100 625L245 680L335 445Z"/>',
        '<path d="M685 270Q750 280 795 350L900 625L755 680L665 445Z"/>',
    )
    return ArtGeometry(
        product_bounds=(80, 150, 840, 700),
        regions={
            "body": (
                f'<path data-product-part="hoodie-chest" d="{torso}"/>',
                *sleeves,
            ),
            "trim": (
                '<path d="M355 250Q330 155 500 150Q670 155 645 250Q585 315 500 325Q415 315 355 250Z"/>',
                '<path d="M252 780H748V840H252Z"/>',
                '<path d="M100 625L245 680L225 730L82 675Z"/>',
                '<path d="M900 625L755 680L775 730L918 675Z"/>',
            ),
            "accent": (
                '<path d="M268 325L315 290L338 430L305 520L270 475Z"/>',
                '<path d="M732 325L685 290L662 430L695 520L730 475Z"/>',
            ),
        },
        details=(
            '<path d="M440 265L420 455M560 265L580 455"/>',
            '<circle cx="418" cy="465" r="10"/><circle cx="582" cy="465" r="10"/>',
            '<path d="M365 620Q500 585 635 620L610 715H390Z"/>',
            '<path d="M390 680H610M500 592V715"/>',
            '<path d="M315 270L335 445M685 270L665 445"/>',
        ),
        shadow_plane="M595 220Q650 235 685 270L765 840H620L640 715L700 610L665 445Z",
        highlight_plane="M315 300Q360 252 420 235L392 575Q350 610 305 590Z",
        surface=ArtworkSurface(torso, (235, 220, 530, 620)),
    )


def _trainer() -> ArtGeometry:
    upper_path = (
        "M115 560Q185 525 250 455L330 335Q365 295 420 295L555 300"
        "Q600 350 640 425L705 470Q795 495 870 535Q900 550 900 590"
        "L865 650H155Q105 640 95 600Q92 575 115 560Z"
    )
    sole_path = (
        "M100 610Q135 640 180 645H870Q900 640 905 675Q900 720 850 735"
        "H175Q105 725 90 675Q88 635 100 610Z"
    )
    return ArtGeometry(
        product_bounds=(90, 280, 820, 480),
        regions={
            "upper": (
                f'<path data-product-part="athletic-upper" d="{upper_path}"/>',
            ),
            "sole": (f'<path d="{sole_path}"/>',),
            "trim": (
                '<path d="M115 560Q185 525 250 455L300 510L250 635H145Z"/>',
                '<path d="M705 470Q795 495 870 535L865 650H735L760 555Z"/>',
            ),
            "accent": (
                '<path data-product-part="trainer-tongue" d="M395 305L555 310L575 520L350 485Z"/>',
                '<path data-product-part="trainer-eye-stay" d="M325 350L365 335L515 505L470 535Z"/>',
            ),
        },
        details=(
            f'<path data-product-part="trainer-lace" d="M350 380L510 410L502 428L342 398Z" fill="{DETAIL_INK}" stroke="none"/>',
            f'<path data-product-part="trainer-lace" d="M335 410L525 445L517 463L327 428Z" fill="{DETAIL_INK}" stroke="none"/>',
            f'<path data-product-part="trainer-lace" d="M320 440L540 480L532 498L312 458Z" fill="{DETAIL_INK}" stroke="none"/>',
            f'<path data-product-part="trainer-lace" d="M305 470L552 512L544 530L297 488Z" fill="{DETAIL_INK}" stroke="none"/>',
            f'<path data-product-part="trainer-lace" d="M290 500L565 542L557 560L282 518Z" fill="{DETAIL_INK}" stroke="none"/>',
            f'<path data-product-part="trainer-lace" d="M275 530L565 568L557 586L267 548Z" fill="{DETAIL_INK}" stroke="none"/>',
            '<path d="M165 675H835"/>',
            '<path d="M250 455Q290 520 250 635"/>',
            '<path d="M735 500Q770 555 750 625"/>',
        ),
        shadow_plane="M705 470Q795 495 870 535Q900 550 900 590L865 650H735L760 555Z",
        highlight_plane="M145 540Q205 505 250 455L330 335Q355 305 405 298L385 350Q345 380 300 470L235 555Z",
        surface=ArtworkSurface(upper_path, (95, 295, 805, 355)),
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
    surface_path = "M190 565H690L700 685H200Z"
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
        surface=ArtworkSurface(surface_path, (190, 565, 510, 120)),
    )


def _garden_tool() -> ArtGeometry:
    body_path = (
        "M330 325H675Q735 330 740 390V650Q735 735 650 760H360"
        "Q275 745 270 660V405Q270 345 330 325Z"
    )
    handle_path = (
        "M345 405Q325 205 500 165Q675 205 660 410L585 405"
        "Q590 275 500 255Q410 275 420 400Z"
    )
    spout_path = "M290 470L120 330L78 395L275 585Z"
    rose_path = (
        "M78 300Q105 300 125 330L80 405Q45 395 45 365Q45 330 78 300Z"
    )
    return ArtGeometry(
        product_bounds=(45, 150, 865, 650),
        regions={
            "body": (
                f'<path data-product-part="watering-can-body" d="{body_path}"/>',
            ),
            "handle": (
                f'<path data-product-part="watering-can-handle" d="{handle_path}"/>',
            ),
            "accent": (
                f'<path data-product-part="watering-can-spout" d="{spout_path}"/>',
                f'<path data-product-part="watering-can-spout" d="{rose_path}"/>',
            ),
        },
        details=(
            '<path d="M305 415Q500 390 705 415"/>',
            '<path d="M325 690Q500 725 680 690"/>',
            '<circle cx="72" cy="342" r="5"/><circle cx="92" cy="355" r="5"/><circle cx="70" cy="375" r="5"/>',
        ),
        shadow_plane="M625 325H675Q735 330 740 390V650Q735 735 650 760H600Q670 710 675 640V405Q675 350 625 325Z",
        highlight_plane="M315 365Q335 345 370 340H430V680Q395 705 340 690Q305 675 305 635V410Q305 385 315 365Z",
        surface=ArtworkSurface(body_path, (270, 325, 470, 435)),
    )


def _aquarium() -> ArtGeometry:
    frame = (
        '<path d="M100 190H900V810H100ZM150 250V620H850V250Z" fill-rule="evenodd"/>',
    )
    glass_path = "M150 250H850V620H150Z"
    return ArtGeometry(
        product_bounds=(90, 160, 820, 670),
        regions={
            "body": frame,
            "glass": (
                f'<path data-product-part="full-front-glass" d="{glass_path}" fill-opacity="0.26"/>',
            ),
            "trim": (
                '<path d="M90 180Q90 160 115 160H885Q910 160 910 180V245H90Z"/>',
                '<path d="M90 760H910V830H90Z"/>',
            ),
            "accent": (
                '<path data-product-part="gravel-band" d="M150 620H850V690Q760 675 675 690Q500 710 325 690Q240 675 150 690Z" fill-opacity="0.38"/>',
            ),
        },
        details=(
            '<circle cx="195" cy="330" r="12"/><circle cx="235" cy="290" r="8"/>',
            '<path d="M150 250H850V620H150Z"/>',
            '<path d="M190 655H810"/>',
            '<path d="M170 785H830"/>',
        ),
        shadow_plane="M800 250H850V620H800ZM820 620H900V810H820Z",
        highlight_plane="M175 275H220V535H175ZM220 275H500V305H220Z",
        surface=ArtworkSurface(glass_path, (150, 250, 700, 370)),
    )


def _pet_shop() -> ArtGeometry:
    building = "M90 270L175 175H825L910 270V840H90Z"
    sign_path = (
        "M150 180H850Q875 180 875 205V440Q875 465 850 465H150"
        "Q125 465 125 440V205Q125 180 150 180Z"
    )
    return ArtGeometry(
        product_bounds=(80, 145, 840, 695),
        regions={
            "body": (f'<path d="{building}"/>',),
            "window": (
                '<path d="M135 535H390V805H135Z" fill-opacity="0.72"/>',
                '<path d="M610 535H865V805H610Z" fill-opacity="0.72"/>',
            ),
            "trim": (
                '<path d="M80 250L175 145H825L920 250H860L800 195H200L140 250Z"/>',
                '<path d="M420 840V610Q420 500 500 500Q580 500 580 610V840Z"/>',
                '<path d="M120 480H880L850 525H150Z"/>',
            ),
            "sign": (
                f'<path data-product-part="pet-shop-fascia" d="{sign_path}"/>',
            ),
        },
        details=(
            '<path d="M300 480L285 525M500 480V525M700 480L715 525"/>',
            '<path d="M262 535V805M738 535V805M135 680H390M610 680H865"/>',
            '<path d="M455 610Q455 545 500 545Q545 545 545 610V840"/>',
            '<path data-product-part="scale-cue" d="M680 770Q725 742 770 770L755 800H695Z"/>',
        ),
        shadow_plane="M800 195L910 270V840H790L815 525L850 465H820Z",
        highlight_plane="M125 285H175V805H125ZM175 180H500V220H175Z",
        surface=ArtworkSurface(sign_path, (125, 180, 750, 285)),
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


def _slim_can_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M155 220Q500 180 845 220V780Q500 820 155 780Z",
        (155, 180, 690, 640),
    )
    return FlatSkinGeometry(
        surface=surface,
        regions={
            "body": (f'<path d="{surface.path}"/>',),
            "trim": (
                '<path d="M155 220Q500 180 845 220V260Q500 220 155 260Z"/>',
                '<path d="M155 740Q500 780 845 740V780Q500 820 155 780Z"/>',
            ),
            "accent": (
                '<path d="M800 225Q823 222 845 220V780Q823 778 800 775Z"/>',
            ),
            "label": (
                '<path d="M220 285Q500 255 780 285V715Q500 745 220 715Z"/>',
            ),
        },
        details=(
            '<path data-mapping-part="can-rim" d="M175 238Q500 202 825 238"/>',
            '<path data-mapping-part="wrap-seam" d="M800 265V735"/>',
        ),
        mapping_target="slim-can",
    )


def _sports_bottle_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M150 215H850L810 315V685L850 785H150L190 685V315Z",
        (150, 215, 700, 570),
    )
    return FlatSkinGeometry(
        surface=surface,
        regions={
            "body": (f'<path d="{surface.path}"/>',),
            "trim": (
                '<path d="M150 215H850L825 278H175Z"/>',
                '<path d="M175 722H825L850 785H150Z"/>',
            ),
            "accent": (
                '<path d="M780 315H810V685L825 722H793L762 680V320Z"/>',
            ),
            "label": (
                '<path d="M230 330H770V670H230Z"/>',
            ),
        },
        details=(
            '<path data-mapping-part="bottle-shoulder" d="M175 278L190 315M825 278L810 315"/>',
            '<path data-mapping-part="wrap-seam" d="M780 325V675"/>',
        ),
        mapping_target="sports-bottle",
    )


def _snack_pouch_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M150 180H850L880 800Q790 840 700 815Q500 855 300 815Q210 840 120 800Z",
        (120, 180, 760, 675),
    )
    return FlatSkinGeometry(
        surface=surface,
        regions={
            "body": (f'<path d="{surface.path}"/>',),
            "trim": (
                '<path d="M150 180H850L855 250H145Z"/>',
                '<path d="M145 760Q220 800 305 780Q500 820 695 780Q780 800 855 760L880 800Q790 840 700 815Q500 855 300 815Q210 840 120 800Z"/>',
            ),
            "accent": (
                '<path d="M145 250L205 775L120 800Z"/>',
                '<path d="M855 250L795 775L880 800Z"/>',
            ),
            "label": (
                '<path d="M225 285H775L805 720Q735 750 675 735Q500 770 325 735Q265 750 195 720Z"/>',
            ),
        },
        details=(
            '<path data-mapping-part="pouch-seal" d="M155 215H845"/>',
            '<path data-mapping-part="pouch-gusset" d="M170 770Q230 800 305 780Q500 820 695 780Q770 800 830 770"/>',
            '<path data-mapping-part="pouch-side-fold" d="M160 255L205 755M840 255L795 755"/>',
        ),
        mapping_target="snack-pouch",
    )


def _takeaway_box_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M120 300H340V180H760V300H900V700H760V820H340V700H120Z",
        (120, 180, 780, 640),
    )
    return FlatSkinGeometry(
        surface=surface,
        regions={
            "body": (f'<path d="{surface.path}"/>',),
            "trim": (
                '<path d="M340 180H760V300H340Z"/>',
                '<path d="M340 700H760V820H340Z"/>',
            ),
            "accent": (
                '<path d="M120 300H340V700H120Z"/>',
                '<path d="M760 300H900V700H760Z"/>',
            ),
            "label": (
                '<path d="M365 325H735V485H365Z"/>',
                '<path d="M365 515H735V675H365Z"/>',
            ),
        },
        details=(
            '<path data-mapping-part="box-fold" d="M340 300H760M340 700H760M340 300V700M760 300V700"/>',
            '<path data-mapping-part="box-flap" d="M390 220H710M390 780H710"/>',
        ),
        mapping_target="takeaway-box",
    )


FLAT_SKIN_BUILDERS: dict[Archetype, FlatSkinBuilder] = {
    "slim-can": _slim_can_skin,
    "sports-bottle": _sports_bottle_skin,
    "snack-pouch": _snack_pouch_skin,
    "takeaway-box": _takeaway_box_skin,
}


def artwork_surface_for(archetype: Archetype) -> ArtworkSurface:
    """Return the exact product-face surface used to clip preview artwork."""

    return GEOMETRY_BUILDERS[archetype]().surface


def _semantic_regions(
    prototype: AuditionPrototype,
    geometry: ArtGeometry,
    flat_skin: FlatSkinGeometry | None,
) -> str:
    available = flat_skin.regions if flat_skin is not None else geometry.regions
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


def _flat_skin_layers(regions: str, flat_skin: FlatSkinGeometry) -> str:
    details = "".join(flat_skin.details)
    return (
        f'<g data-product-shell="flat-skin" data-flat-skin-kind="product-specific" '
        f'data-mapping-target="{escape(flat_skin.mapping_target)}" stroke="{INK}" '
        f'stroke-width="{OUTER_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{regions}</g>'
        f'<g data-detail-layer="true" fill="none" stroke="{DETAIL_INK}" '
        f'stroke-width="{DETAIL_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{details}</g>'
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
    x, y, width, height = surface.bounds
    return (
        f'<g data-guide-overlay="true" data-selection-chrome="true" '
        f'data-editor-only="true" data-export="false" visibility="{visibility}">'
        f'<path data-print-area="primary" d="{surface.path}" fill="{GUIDE}" '
        'fill-opacity="0.15" stroke="none"/>'
        f'<path data-selection-outline="primary" d="{surface.path}" fill="none" '
        f'stroke="{GUIDE}" stroke-width="{OUTER_STROKE}" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<g data-corner-guides="true" fill="none" stroke="{GUIDE}" '
        f'stroke-width="{OUTER_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{_corner_guides(x, y, width, height)}</g>'
        "</g>"
    )


def render_audition_svg(prototype: AuditionPrototype, view: View) -> str:
    """Render one safe audition shell without external content or active markup."""

    if view not in ("authoring", "preview", "review"):
        raise ValueError(f"unsupported audition view: {view}")

    geometry = GEOMETRY_BUILDERS[prototype.archetype]()
    flat_skin = (
        flat_skin_geometry_for(prototype.archetype)
        if prototype.authoring_mode == "flat-skin" and view != "preview"
        else None
    )
    surface = flat_skin.surface if flat_skin is not None else geometry.surface
    clip_id = f"{prototype.id}-primary-artwork-clip"
    regions = _semantic_regions(prototype, geometry, flat_skin)
    layers = (
        _flat_skin_layers(regions, flat_skin)
        if flat_skin is not None
        else _object_layers(geometry, regions)
    )
    grounding = _grounding_shadow(geometry.product_bounds) if view == "preview" else ""
    artwork_slot = (
        f'<g data-artwork-slot="primary" clip-path="url(#{escape(clip_id)})"></g>'
    )

    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" '
        'data-light-direction="top-left" '
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
    "FLAT_SKIN_BUILDERS",
    "FlatSkinBuilder",
    "FlatSkinGeometry",
    "GEOMETRY_BUILDERS",
    "GUIDE",
    "INK",
    "OUTER_STROKE",
    "PAPER",
    "artwork_surface_for",
    "flat_skin_geometry_for",
    "render_audition_svg",
]
