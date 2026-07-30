extends RefCounted
class_name AdMarketTestCampaignImageDecoder

const Decoder = preload("res://src/presentation/campaign_image_decoder.gd")

func run() -> bool:
	var publication := _publication()
	var texture: ImageTexture = Decoder.decode(publication)
	assert(texture != null)
	assert(texture.get_image().get_width() == 1600)
	assert(texture.get_image().get_height() == 900)
	assert(Decoder.decode(_changed(publication, "contract", "published-campaign@999")) == null)
	assert(Decoder.decode(_publication_with_size(1599, 900)) == null)
	assert(Decoder.decode(_publication_with_size(1600, 899)) == null)
	assert(Decoder.decode(_changed(publication, "pngBase64", "not-base64")) == null)
	assert(Decoder.decode(_changed(publication, "pngBase64", "!!!!")) == null)
	assert(Decoder.decode(_changed(publication, "pngBase64", "AA=A")) == null)
	assert(Decoder.decode(_changed(publication, "pngBase64", Marshalls.raw_to_base64(PackedByteArray([1, 2, 3])))) == null)
	return true

func _publication() -> Dictionary:
	return _publication_with_size(1600, 900)

func _publication_with_size(width: int, height: int) -> Dictionary:
	var image := Image.create_empty(width, height, false, Image.FORMAT_RGBA8)
	image.fill(Color("243248"))
	return {
		"contract": "published-campaign@1",
		"documentId": "campaign-pitch-test",
		"revision": 4,
		"pngBase64": Marshalls.raw_to_base64(image.save_png_to_buffer()),
		"metadata": {},
	}

func _changed(publication: Dictionary, key: String, value: Variant) -> Dictionary:
	var changed := publication.duplicate(true)
	changed[key] = value
	return changed