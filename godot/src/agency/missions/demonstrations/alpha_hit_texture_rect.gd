extends TextureRect
class_name AdMarketAlphaHitTextureRect

const DEFAULT_ALPHA_THRESHOLD := 0.1

@export_range(0.0, 1.0, 0.01) var alpha_hit_threshold: float = DEFAULT_ALPHA_THRESHOLD

var _cached_texture: Texture2D = null
var _cached_image: Image = null

## Pointer hits follow the visible sprite rather than the TextureRect's transparent box.
func is_opaque_at(point: Vector2) -> bool:
	if (
		point.x < 0.0
		or point.y < 0.0
		or point.x >= size.x
		or point.y >= size.y
		or size.x <= 0.0
		or size.y <= 0.0
	):
		return false
	var image := _image_for_hit_test()
	if image == null or image.is_empty():
		return false
	var source_point := Vector2i(
		clampi(int(floor(point.x / size.x * image.get_width())), 0, image.get_width() - 1),
		clampi(int(floor(point.y / size.y * image.get_height())), 0, image.get_height() - 1)
	)
	return image.get_pixelv(source_point).a >= alpha_hit_threshold

func _has_point(point: Vector2) -> bool:
	return is_opaque_at(point)

func _image_for_hit_test() -> Image:
	if texture != _cached_texture:
		_cached_texture = texture
		_cached_image = texture.get_image() if texture != null else null
	return _cached_image
