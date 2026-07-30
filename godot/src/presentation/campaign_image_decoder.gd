extends RefCounted
class_name AdMarketCampaignImageDecoder

const PUBLICATION_CONTRACT := "published-campaign@1"
const CANVAS_WIDTH := 1600
const CANVAS_HEIGHT := 900
const MAX_PNG_BYTES := 4 * 1024 * 1024
const MAX_BASE64_LENGTH := 5_592_408
const PNG_SIGNATURE := [137, 80, 78, 71, 13, 10, 26, 10]

static func decode(publication: Dictionary) -> ImageTexture:
	if String(publication.get("contract", "")) != PUBLICATION_CONTRACT:
		return null
	if not _valid_identity(publication):
		return null
	var encoded: Variant = publication.get("pngBase64")
	if typeof(encoded) != TYPE_STRING:
		return null
	var base64 := String(encoded)
	if base64.is_empty() or base64.length() > MAX_BASE64_LENGTH or not _valid_base64(base64):
		return null
	var png_bytes := Marshalls.base64_to_raw(base64)
	if png_bytes.is_empty() or png_bytes.size() > MAX_PNG_BYTES:
		return null
	if not _has_png_signature(png_bytes):
		return null
	var image := Image.new()
	if image.load_png_from_buffer(png_bytes) != OK:
		return null
	if image.get_width() != CANVAS_WIDTH or image.get_height() != CANVAS_HEIGHT:
		return null
	return ImageTexture.create_from_image(image)

static func _valid_base64(value: String) -> bool:
	if value.length() < 12 or value.length() % 4 != 0:
		return false
	var padding_count := 0
	for index in value.length():
		var code := value.unicode_at(index)
		if code == 61:
			padding_count += 1
			if padding_count > 2 or index < value.length() - 2:
				return false
			continue
		if padding_count > 0:
			return false
		var is_alphanumeric := (
			(code >= 65 and code <= 90)
			or (code >= 97 and code <= 122)
			or (code >= 48 and code <= 57)
		)
		if not is_alphanumeric and code not in [43, 47]:
			return false
	return true

static func _valid_identity(publication: Dictionary) -> bool:
	var document_id: Variant = publication.get("documentId")
	var revision: Variant = publication.get("revision")
	if typeof(document_id) != TYPE_STRING or String(document_id).strip_edges().is_empty():
		return false
	if typeof(revision) not in [TYPE_INT, TYPE_FLOAT]:
		return false
	var revision_number := float(revision)
	return revision_number >= 0.0 and revision_number == floor(revision_number)

static func _has_png_signature(bytes: PackedByteArray) -> bool:
	if bytes.size() < PNG_SIGNATURE.size():
		return false
	for index in PNG_SIGNATURE.size():
		if bytes[index] != PNG_SIGNATURE[index]:
			return false
	return true