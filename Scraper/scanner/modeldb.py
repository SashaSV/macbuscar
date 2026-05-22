from dataclasses import dataclass
from datetime import datetime
from bson.objectid import ObjectId
from datetime import timedelta
from pymongo import MongoClient
from umongo import Document, EmbeddedDocument, fields, validate
from umongo.frameworks import PyMongoInstance

class Database:
	@classmethod
	def initialize(cls, dbconnect):
		client = MongoClient(dbconnect)
		cls.database = client.get_default_database()
		return PyMongoInstance(cls.database)

instance = Database.initialize("mongodb://localhost:27017/bldb")

@instance.register
class Locale(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    LanguageId = fields.StringField()
    LocaleKey = fields.StringField()
    LocaleValue = fields.StringField()

@instance.register
class Adress(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StrField())
    FirstName = fields.StringField(default=None)
    LastName = fields.StringField(default=None)
    Email = fields.StringField(default=None)
    Company = fields.StringField(default=None)
    VatNumber = fields.StringField(default=None)
    CountryId = fields.StringField(default=None)
    StateProvinceId = fields.StringField(default=None)
    City = fields.StringField(default=None)
    Address1 = fields.StringField(default=None)
    Address2 = fields.StringField(default=None)
    ZipPostalCode = fields.StringField(default=None)
    PhoneNumber = fields.StringField(default=None)
    FaxNumber = fields.StringField(default=None)
    CustomAttributes = fields.ListField(fields.StrField())
    CreatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    

@instance.register
class Vendor(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StrField())
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    PictureId = fields.StringField(default=None)
    Email = fields.StringField(default=None)
    Description = fields.StringField(default=None)
    StoreId = fields.StringField(default=None)
    AdminComment = fields.StringField(default=None)
    Active = fields.BooleanField(default=True)
    Deleted = fields.BooleanField(default=False)
    DisplayOrder = fields.IntegerField(default=0)
    MetaKeywords = fields.BooleanField(default=True)
    MetaDescription = fields.BooleanField(default=True)
    MetaTitle = fields.BooleanField(default=True)
    PageSize = fields.IntegerField(default=20)
    AllowCustomersToSelectPageSize = fields.BooleanField(default=True)
    PageSizeOptions = fields.IntegerField(default=0)
    AllowCustomerReviews = fields.BooleanField(default=True)
    ApprovedRatingSum = fields.IntegerField(default=0)
    NotApprovedRatingSum = fields.IntegerField(default=0)
    ApprovedTotalReviews = fields.IntegerField(default=0)
    NotApprovedTotalReviews = fields.IntegerField(default=0)
    Commission = fields.IntegerField(default=0)
    Addresses = fields.ListField(fields.EmbeddedField(Adress,default=None), default = [])
    Locales = fields.ListField(fields.EmbeddedField(Locale,default=None), default = [])
    VendorNotes = fields.ListField(fields.StrField(default=None))
    AppliedDiscounts = fields.ListField(fields.StrField(default=None))
    VendorSpecificationAttributes = fields.ListField(fields.StrField(default=None), default = [])
    IsPrivatePerson = fields.BooleanField(default=False)

    class Meta:
        collection_name = "Vendor"

@instance.register
class Manufacturer(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StrField())
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    Description = fields.StringField(default=None)
    BottomDescription = fields.StringField(default=None)
    ManufacturerTemplateId = fields.StringField(default=None)
    MetaKeywords = fields.StringField(default=None)
    MetaDescription = fields.StringField(default=None)
    MetaTitle = fields.StringField(default=None)
    ParentCategoryId = fields.StringField(default=None)
    PictureId = fields.StringField(default=None)
    PageSize = fields.IntegerField(default=20)
    AllowCustomersToSelectPageSize = fields.BooleanField(default=True)
    PageSizeOptions = fields.StringField(default=None)
    PriceRanges = fields.StringField(default=None)
    ShowOnHomePage = fields.BooleanField(default=False)
    FeaturedProductsOnHomaPage = fields.BooleanField(default=False)
    IncludeInTopMenu = fields.BooleanField(default=False)
    SubjectToAcl = fields.BooleanField(default=False)
    CustomerRoles = fields.ListField(fields.StrField())
    LimitedToStores = fields.BooleanField(default=False)
    Stores = fields.ListField(fields.StrField())
    Published = fields.BooleanField(default=True)
    DisplayOrder = fields.IntegerField(default=0)
    Icon = fields.StringField(default=None)
    DefaultSort = fields.IntegerField(default=5)
    HideOnCatalog = fields.BooleanField(default=False)
    CreatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    UpdatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    AppliedDiscounts = fields.ListField(fields.StrField())
    Locales = fields.ListField(fields.EmbeddedField(Locale),default=[])

    class Meta:
        collection_name = "Manufacturer"

@instance.register
class SpecificationAttributeOption(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    ColorSquaresRgb = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=0)
    ParentSpecificationAttrOptionId = fields.StringField(default=None)
    Locales = fields.ListField(fields.EmbeddedField(Locale),default=[])

@instance.register
class SpecificationAttribute(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StrField())
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=0)
    Locales = fields.ListField(fields.EmbeddedField(Locale),default=[])
    SpecificationAttributeOptions= fields.ListField(fields.EmbeddedField(SpecificationAttributeOption), default=[]) 
    
    class Meta:
        collection_name = "SpecificationAttribute"

@instance.register
class UrlRecord(Document):
    _id = fields.StringField(unique=True, default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StrField())
    EntityId = fields.StringField(default=None)
    EntityName = fields.StringField(default=None)
    Slug = fields.StringField(default=None)
    IsActive = fields.BooleanField(default=True)
    LanguageId = fields.StringField(default=None)
    
    class Meta:
        collection_name = "UrlRecord"
 

@instance.register
class CategorySpecificationAttributes(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StringField())
    CategoryId = fields.StringField(default=None)
    AttributeTypeId = fields.IntegerField(default=0)
    SpecificationAttributeId = fields.StringField(default=None)
    DetailsUrl = fields.StringField(default=None)
    SpecificationAttributeOptionId = fields.StringField(default=None)
    CustomValue = fields.StringField(default=None)
    AllowFiltering = fields.BooleanField(default=False)
    ShowOnProductPage = fields.BooleanField(default=True)
    DisplayOrder = fields.IntegerField(default=0)
    Locales = fields.ListField(fields.EmbeddedField(Locale), default = [])
    AttributeType = fields.IntegerField()

@instance.register
class CategoryTemplate(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    ViewPath = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=0)
    
    class Meta:
        collection_name = "CategoryTemplate"

@instance.register
class Category(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    Description = fields.StringField(default=None)
    BottomDescription = fields.StringField(default=None)
    CategoryTemplateId = fields.StringField(default=CategoryTemplate.find_one().id)
    MetaKeywords = fields.StringField(default=None)
    MetaDescription = fields.StringField(default=None)
    MetaTitle = fields.StringField(default=None)
    ParentCategoryId = fields.StringField(default=None)
    PictureId = fields.StringField(default=None)
    PageSize = fields.IntegerField(default=20)
    AllowCustomersToSelectPageSize = fields.BooleanField(default=False)
    PageSizeOptions = fields.StringField(default="6 3 9")
    PriceRanges = fields.NumberField(default=None)
    ShowOnHomePage = fields.BooleanField(default=False)
    FeaturedProductsOnHomaPage = fields.BooleanField(default=False)
    ShowOnSearchBox = fields.BooleanField(default=False)
    SearchBoxDisplayOrder = fields.IntegerField(default=False)
    IncludeInTopMenu = fields.BooleanField(default=False)
    SubjectToAcl = fields.BooleanField(default=False)
    CustomerRoles = fields.ListField(fields.StringField())
    Stores = fields.ListField(fields.StringField())
    LimitedToStores = fields.BooleanField(default=False)
    Published = fields.BooleanField(default=True)
    DisplayOrder = fields.IntegerField(default=0)
    Flag = fields.StringField(default=None)
    FlagStyle = fields.StringField(default=None)
    Icon = fields.StringField(default=None)
    DefaultSort = fields.IntegerField(default=0)
    HideOnCatalog = fields.BooleanField(default=False)
    CreatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    UpdatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    AppliedDiscounts = fields.ListField(fields.StringField())
    CategorySpecificationAttributes = fields.ListField(fields.EmbeddedField(CategorySpecificationAttributes), default = [])
    Locales = fields.ListField(fields.EmbeddedField(Locale), default = [])
    Active = fields.BooleanField(default=False)
    Deleted = fields.BooleanField(default=False)
    
    class Meta:
        collection_name = "Category"

@instance.register
class ProductCategoryRel(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    CategoryId = fields.StringField(default=None)
    IsFeaturedProduct = fields.BooleanField(default=False)
    DisplayOrder = fields.IntegerField(default=0)

@instance.register
class ProductManufacturerRel(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    ManufacturerId = fields.StringField(default=None)
    IsFeaturedProduct = fields.BooleanField(default=False)
    DisplayOrder = fields.IntegerField(default=0)

@instance.register
class ProductSpecificationAttributeRel(EmbeddedDocument):
        _id = fields.StringField(default=str(ObjectId()))
        AttributeTypeId = fields.IntegerField(default=0)
        SpecificationAttributeId = fields.StringField(default=None)
        SpecificationAttributeOptionId = fields.StringField(default=None)
        CustomValue = fields.StringField(default=None)
        AllowFiltering = fields.BooleanField(default=False)
        ShowOnProductPage = fields.BooleanField(default=True)
        ShowOnSellerPage = fields.BooleanField(default=True)
        DisplayOrder = fields.IntegerField(default=0)
        Locales = fields.ListField(fields.EmbeddedField(Locale), default = [])
    
@instance.register
class TierPrice(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    StoreId = fields.StringField(default=None)
    CustomerRoleId = fields.StringField(default=None)
    Quantity = fields.IntegerField(default=0)
    Price = fields.NumberField(default=0.0)
    StartDateTimeUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    EndDateTimeUtc = fields.StringField(default=None)

@instance.register
class ProductPicture(EmbeddedDocument):
    _id = fields.StringField(default=str(ObjectId()))
    PictureId = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)
    MimeType = fields.StringField(default=None)    
    SeoFilename = fields.StringField(default=None)
    AltAttribute = fields.StringField(default=None)
    TitleAttribute = fields.StringField(default=None)

@instance.register
class Product(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StringField())
    ProductTypeId = fields.IntegerField(default=5) #singl product
    ParentGroupedProductId = fields.StringField(default=None)
    VisibleIndividually = fields.BooleanField(default=False)
    Name = fields.StringField(default=None)
    SeName = fields.StringField(default=None)
    ShortDescription = fields.StringField(default=None)
    Url = fields.StringField(default=None)
    ProductTemplateId = fields.StringField(default=None)
    VendorId = fields.StringField(default=None)
    Sku = fields.StringField(default=None)
    RecurringCycleLength = fields.IntegerField(default=100)
    Weeldiam = fields.StringField(default=None)
    ManufactureName = fields.StringField(default=None)
    Model = fields.StringField(default=None)
    Year = fields.StringField(default=None)
    Color = fields.StringField(default=None)
    Size = fields.StringField(default=None)
    FullDescription = fields.StringField(default=None)
    AdminComment = fields.StringField(default=None)
    ShowOnHomePage = fields.BooleanField(default=False)
    MetaKeywords = fields.StringField(default=None)
    MetaDescription = fields.StringField(default=None)
    MetaTitle = fields.StringField(default=None)
    AllowCustomerReviews = fields.BooleanField(default=True)
    ApprovedRatingSum = fields.IntegerField(default=0)
    NotApprovedRatingSum = fields.IntegerField(default=0)
    ApprovedTotalReviews = fields.IntegerField(default=0)
    NotApprovedTotalReviews = fields.IntegerField(default=0)
    SubjectToAcl = fields.BooleanField(default=False)
    CustomerRoles = fields.ListField(fields.StringField())
    LimitedToStores = fields.BooleanField(default=False)
    Stores = fields.ListField(fields.StringField())
    ExternalId = fields.StringField(default=None)
    ManufacturerPartNumber = fields.StringField(default=None)
    Gtin = fields.StringField(default=None)
    IsGiftCard = fields.BooleanField(default=False)
    GiftCardTypeId = fields.IntegerField(default=0)
    OverriddenGiftCardAmount = fields.StringField(default=None)
    RequireOtherProducts = fields.BooleanField(default=False)
    RequiredProductIds = fields.StringField(default=None)
    AutomaticallyAddRequiredProducts = fields.BooleanField(default=False)
    IsDownload = fields.BooleanField(default=False)
    DownloadId = fields.StringField(default=None)
    UnlimitedDownloads = fields.BooleanField(default=True)
    MaxNumberOfDownloads = fields.IntegerField(default=10)
    DownloadExpirationDays = fields.StringField(default=None)
    DownloadActivationTypeId = fields.IntegerField(default=0)
    HasSampleDownload = fields.BooleanField(default=False)
    SampleDownloadId = fields.StringField(default=None)
    HasUserAgreement = fields.BooleanField(default=False)
    UserAgreementText = fields.StringField(default=None)
    IsRecurring = fields.BooleanField(default=False)
    RecurringCyclePeriodId = fields.IntegerField(default=0)
    RecurringTotalCycles = fields.IntegerField(default=10)
    IncBothDate = fields.BooleanField(default=False)
    Interval = fields.IntegerField(default=0)
    IntervalUnitId = fields.IntegerField(default=0)
    IsShipEnabled = fields.BooleanField(default=False)
    IsFreeShipping = fields.BooleanField(default=False)
    ShipSeparately = fields.BooleanField(default=False)
    AdditionalShippingCharge = fields.IntegerField(default=0)
    DeliveryDateId = fields.StringField(default=None)
    IsTaxExempt = fields.BooleanField(default=False)
    TaxCategoryId = fields.StringField(default=None)
    IsTele = fields.BooleanField(default=False)
    ManageInventoryMethodId = fields.IntegerField(default=0)
    UseMultipleWarehouses = fields.BooleanField(default=False)
    WarehouseId = fields.StringField(default=None)
    StockQuantity = fields.IntegerField(default=0)
    DisplayStockAvailability = fields.BooleanField(default=False)
    DisplayStockQuantity = fields.BooleanField(default=False)
    MinStockQuantity = fields.IntegerField(default=0)
    LowStock = fields.BooleanField(default=True)
    LowStockActivityId = fields.IntegerField(default=0)
    NotifyAdminForQuantityBelow = fields.IntegerField(default=1)
    BackorderModeId = fields.IntegerField(default=0)
    AllowBackInStockSubscriptions = fields.BooleanField(default=False)
    OrderMinimumQuantity = fields.IntegerField(default=1)
    OrderMaximumQuantity = fields.IntegerField(default=1000)
    AllowedQuantities = fields.StringField(default=None)
    AllowAddingOnlyExistingAttributeCombinations = fields.BooleanField(default=False)
    NotReturnable = fields.BooleanField(default=False)
    DisableBuyButton = fields.BooleanField(default=False)
    DisableWishlistButton = fields.BooleanField(default=False)
    AvailableForPreOrder = fields.BooleanField(default=False)
    PreOrderAvailabilityStartDateTimeUtc = fields.StringField(default=None)
    CallForPrice = fields.BooleanField(default=False)
    Price = fields.NumberField(default=0.0)
    OldPrice = fields.NumberField(default=0.0)
    CatalogPrice = fields.NumberField(default=0.0)
    ProductCost = fields.NumberField(default=0.0)
    CustomerEntersPrice = fields.BooleanField(default=False)
    MinimumCustomerEnteredPrice = fields.NumberField(default=0.0)
    MaximumCustomerEnteredPrice = fields.NumberField(default=1000.0)
    BasepriceEnabled = fields.BooleanField(default=False)
    BasepriceAmount = fields.IntegerField(default=0)
    BasepriceUnitId = fields.StringField(default=None)
    BasepriceBaseAmount = fields.IntegerField(default=0)
    BasepriceBaseUnitId = fields.StringField(default=None)
    UnitId = fields.StringField(default=None)
    CourseId = fields.StringField(default=None)
    MarkAsNew = fields.BooleanField(default=True)
    MarkAsNewStartDateTimeUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()-timedelta(days=1)), default = datetime.now()-timedelta(days=1))
    MarkAsNewEndDateTimeUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()+timedelta(days=30)), default = datetime.now()+timedelta(days=30))
    Weight = fields.IntegerField(default=0)
    Length = fields.IntegerField(default=0)
    Width = fields.IntegerField(default=0)
    Height = fields.IntegerField(default=0)
    AvailableStartDateTimeUtc = fields.StringField(default=None)
    AvailableEndDateTimeUtc = fields.StringField(default=None)
    StartPrice = fields.IntegerField(default=0)
    HighestBid = fields.IntegerField(default=0)
    HighestBidder = fields.StringField(default=None)
    AuctionEnded = fields.BooleanField(default=False)
    DisplayOrder = fields.IntegerField(default=0)
    DisplayOrderCategory = fields.IntegerField(default=0)
    DisplayOrderManufacturer = fields.IntegerField(default=0)
    Published = fields.BooleanField(default=True)
    CreatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    UpdatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())
    Sold = fields.IntegerField(default=0)
    Viewed = fields.IntegerField(default=0)
    OnSale = fields.IntegerField(default=0)
    Flag = fields.StringField(default=None)
    Locales = fields.ListField(fields.EmbeddedField(Locale), default = [])
    ProductCategories = fields.ListField(fields.EmbeddedField(ProductCategoryRel), default = [])
    ProductManufacturers = fields.ListField(fields.EmbeddedField(ProductManufacturerRel), default = [])
    ProductPictures = fields.ListField(fields.EmbeddedField(ProductPicture), default = []) 
    ProductSpecificationAttributes = fields.ListField(fields.EmbeddedField(ProductSpecificationAttributeRel), default = [])
    ProductTags = fields.ListField(fields.StringField())
    ProductAttributeMappings = fields.ListField(fields.StringField())
    ProductAttributeCombinations = fields.ListField(fields.StringField())
    TierPrices = fields.ListField(fields.EmbeddedField(TierPrice), default = [])
    AppliedDiscounts = fields.ListField(fields.StringField())
    ProductWarehouseInventory = fields.ListField(fields.StringField())
    CrossSellProduct = fields.ListField(fields.StringField())
    RelatedProducts = fields.ListField(fields.StringField())
    SimilarProducts = fields.ListField(fields.StringField())
    BundleProducts = fields.ListField(fields.StringField())

    class Meta:
        collection_name = "Product"

import bson
#from marshmallow import  fields as ma_fields
from marshmallow.exceptions import ValidationError
class BinaryField(fields.BaseField):
    def _validate(self, value):
        if not isinstance(value, bytes):
            raise ValidationError('Invalid input type.')

        if value is None or value == b'':
            raise ValidationError('Invalid value')

    
@instance.register
class Picture(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StringField())
    PictureBinary = BinaryField(required=True)
    MimeType= fields.StringField(default='image/jpeg')
    SeoFilename = fields.StringField(default=None)
    UrlImage = fields.StringField(default=None)
    AltAttribute = fields.StringField(default=None)
    TitleAttribute = fields.StringField(default=None)
    IsNew = fields.BooleanField(default=True)
    Geometry = fields.BooleanField(default=False)

    class Meta:
        collection_name = "Picture"

@instance.register
class Language(Document):
    _id = fields.StringField(default=str(ObjectId()))
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    LanguageCulture = fields.StringField(default=None)
    UniqueSeoCode= fields.StringField(default=None)
    FlagImageFileName = fields.StringField(default=None)
    Rtl = fields.BooleanField(default=False)
    LimitedToStores = fields.BooleanField(default=False)
    Stores = fields.ListField(fields.StringField())
    DefaultCurrencyId = fields.StringField(default=None)
    Published = fields.BooleanField(default=True)
    DisplayOrder = fields.IntegerField(default=2)

    class Meta:
        collection_name = "Language"

@instance.register
class ManufacturerTemplate(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    ViewPath = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)

    class Meta:
        collection_name = "ManufacturerTemplate"


@instance.register
class ProductTemplate(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    ViewPath = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=10)

    class Meta:
        collection_name = "ProductTemplate"

@instance.register
class DeliveryDate(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    ViewPath = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)
    ColorSquaresRgb = fields.StringField(default=None)
    Locales = fields.ListField(fields.EmbeddedField(Locale), default = [])
    class Meta:
        collection_name = "DeliveryDate"


@instance.register
class TaxCategory(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)

    class Meta:
        collection_name = "TaxCategory"

@instance.register
class MeasureUnit(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)

    class Meta:
        collection_name = "MeasureUnit"

@instance.register
class Warehouse(Document):
    GenericAttributes = fields.ListField(fields.StringField())
    Name = fields.StringField(default=None)
    DisplayOrder = fields.IntegerField(default=1)

    class Meta:
        collection_name = "Warehouse"

@instance.register
class PrivateMessage(Document):
    StoreId = fields.StringField(default=None)
    AdId = fields.StringField(default=None)
    FromCustomerId = fields.StringField(default=None)
    ToCustomerId = fields.StringField(default=None)
    Subject = fields.StringField(default=None)
    Text = fields.StringField(default=None)
    IsRead = fields.BooleanField(default=False)
    IsDeletedByAuthor = fields.BooleanField(default=False)
    IsDeletedByRecipient = fields.BooleanField(default=False)
    CreatedOnUtc = fields.DateTimeField(validate=validate.Range(min=datetime.now()), default = datetime.now())

    class Meta:
        collection_name = "PrivateMessage"