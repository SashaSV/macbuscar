from pymongo import MongoClient
from dataclasses import dataclass
import json
from bson.objectid import ObjectId
import pytils.translit
import os
from urllib.request import urlretrieve
from scanner.modeldb import Adress, Vendor, Category, Picture, Manufacturer, UrlRecord, TierPrice, Product, ProductCategoryRel,\
                            SpecificationAttribute, SpecificationAttributeOption, Locale,\
                            Language, Manufacturer, ProductManufacturerRel, ManufacturerTemplate,\
                            ProductTemplate, DeliveryDate, TaxCategory, MeasureUnit, Warehouse,\
                            ProductSpecificationAttributeRel, ProductPicture, PrivateMessage

from datetime import datetime

#from marshmallow import Schema, fields, post_load

#
_filteringAtribute = ["manufacturer", "vendor", "available"
                      ,"color", "model", "year"
                      ,"memory", "display", "cpu", "hdd"]

from datetime import datetime

@dataclass
class DataScraps:
    url: str = ''
    name: str = ''
    sku: str = ''
    manufacturer: str = ''
    category: str = ''
    subcategory: list[str] = None
    price: float = 0.0
    oldprice: float = 0.0
    vendor: str = ''
    available: str = ''
    techs: list[str] = None
    images: list[str] = None
    model: list[str] = None
    color: str = ''
    year: str = ''
    memory: str = ''
    display: str = ''
    cpu: str = ''
    hdd: str = ''

    def __post_init__(self):
        self.techs = []
        self.images = []
        self.model = []
        self.subcategory = []

    def pars_name(self) -> None:
        deletewords = []

        name = self.name
        
        for word in deletewords:
            name = name.replace(word, '').strip()

        self.year = chek_so_name(name, 'year')
        self.cpu = chek_so_name(name, 'cpu')
        self.manufacturer = chek_so_name(name, 'manufacturer')

        for n in name.split(' '):
            #manufacturer = chek_so_name(n, 'manufacturer')
            #if len(manufacturer) > 0:
            #    self.manufacturer = manufacturer
                
            #year = chek_so_name(n, 'year')
            
            if self.year.name in (None,''):
                curyear = datetime.now().year+1
                y = curyear
                year = None
                while y >= curyear - 15:
                    if name.find(str(y)) > 0:
                        year = str(y)
                        
                    y = y - 1

                if year:
                    self.year = Spec(year)
            
            self.cpu = chek_so_name(n, 'cpu')
        
        self.display = chek_so_name(name, 'display')
        self.memory = chek_so_name(name, 'memory')
        self.hdd = chek_so_name(name, 'hdd')
        self.color = chek_so_name(name, 'color')       
        self.model = chek_so_name(name, 'model')

class DataScrapsEncoder(json.JSONEncoder):
    def default(self, obj):
            return obj.__dict__

class obj(object):
    def __init__(self, dict_):
        self.__dict__.update(dict_)

def dict2obj(d):
    return json.loads(json.dumps(d), object_hook=obj)

class Spec:
   def __init__(self, name = '', id = ''):
       self.id = id
       self.name = name

def check_product(data:list[DataScraps]):

    cnt = 0
    for d in data:
        vendorid = check_vendor(d.vendor)      
        name = d.name.strip()
        cnt = cnt + 1

        print('{0}. Загрузка {1}'.format(cnt, name))
        
        p_main = check_mainproduct(d)        

        new_p = Product.find_one({'ParentGroupedProductId': d.sku, 
                                  'VendorId': None  if not vendorid else vendorid._id,
                                  'ParentGroupedProductId':p_main._id})
        if not new_p:
            groupTemplateId = ProductTemplate.find_one({'Name': 'Grouped product (with variants)'})
            new_p = create_product(d)
            new_p.ProductTemplateId = groupTemplateId.id if groupTemplateId else None
            new_p.SeName = get_sename('{0}_{1}'.format(p_main._id,new_p.Sku), new_p._id, 'Product', '')
            new_p.VisibleIndividually = False
            new_p.ProductTypeId = 5
            new_p.VendorId = vendorid._id
            new_p.ParentGroupedProductId = p_main._id
            new_p.Name = '{0} - {1}'.format(name, d.vendor)
            new_p.commit()
       
        add_spec_to_product(new_p, 'available', d.available)

        for f in _filteringAtribute:
            #aa = Spec(**d.__dict__.get(f))
            add_spec_to_product(p_main, f, d.__dict__.get(f))

        print('     Подгрузка характеристик')
        for prop_name, prop_value in d.techs.__dict__.items():
            if prop_value.strip() == '':
                continue
            
            add_spec_to_product(p_main, prop_name, prop_value)

        images = [] if p_main.ProductPictures is None else p_main.ProductPictures

        if len(images) == 0:
            print('     Подгрузка картинок')
            for urlimage in d.images:
                check_image_to_product(p_main, urlimage)
        
        if d.sku == 'B09V4WGX5F':
            aa = 1
            
        find_categories(p_main)
        p_main.commit()

class CategoryRel:
    def __init__(self, categorySpecificationAttributes=None, productSpecificationAttributes=None, productCategories = None):
        self.categorySpecificationAttributes = categorySpecificationAttributes if categorySpecificationAttributes else []
        self.productSpecificationAttributes = productSpecificationAttributes if productSpecificationAttributes else []
        self.productCategories = productCategories if productCategories else []
        self.NewCategoryRel = None
        self._newCategories()
    
    def _findInCurentCategoriesRel(self, categoryId = None) -> bool:
        retVal = False
        for pCatrel in self.productCategories:
            if pCatrel.CategoryId == categoryId:
                retVal = True
        
        return retVal

    def _newCategories(self):
        countFind = 0
        for categorySA in self.categorySpecificationAttributes:
            for producrSA in self.productSpecificationAttributes:
                if (producrSA.SpecificationAttributeId == categorySA.SpecificationAttributeId 
                    and producrSA.SpecificationAttributeOptionId == categorySA.SpecificationAttributeOptionId):
                    countFind += 1
                    if countFind == len(self.categorySpecificationAttributes):
                        if not self._findInCurentCategoriesRel(categorySA.CategoryId):
                            self.NewCategoryRel = ProductCategoryRel(_id = str(ObjectId()), CategoryId = categorySA.CategoryId) 
    
def find_categories(product):
    categories = Category.find()
    
    for category in categories:
        newCategory = CategoryRel(category.CategorySpecificationAttributes, product.ProductSpecificationAttributes, product.ProductCategories).NewCategoryRel
        if newCategory:
            product.ProductCategories.append(newCategory)


import sys
sys.setrecursionlimit(1500)

def add_spec_to_product(p_main, prop_name, prop_val:Spec):
    
    if type(prop_val) is str:
        prop_val = Spec(prop_val)

    if type(prop_val) is list:
        for pv in prop_val:
            add_spec_to_product(p_main, prop_name, pv)
    else:
        if not prop_val.name in (None, ''):
            sao = check_specificationattributeoption_by_name(prop_name, prop_val)
            sa = check_specificationattribute_by_name(prop_name)
            check_productspecificationattributeoption(p_main, sa, sao)

class Option:
    def __init__(self, id=None, parentId=None, name=None):
        self.id = id
        self.parentId = parentId
        self.name = name
        self.names = []
        self.childs = []
        self.parent = None

class Options:
    def __init__(self, specificationAttributeOptions:str):
        self.alloptions = []
        self.allchilds = []
        self.alltrees = []
        self.specificationAttributeOptions = specificationAttributeOptions
        self._options()
        self._trees(self.alltrees)

    def find_childs(self, tree:Option) -> list[Option]:
        self.allchilds = []
        if len(tree.childs) > 0:
            self._childs(tree.childs)
        else:
            self.allchilds.append(tree)

        return self.allchilds
    
    def _childs(self, childs:list[Option]) -> None:
        
        if not childs:
            return None
         
        for child in childs:
            self._childs(child.childs)
            self.allchilds.append(child)

    def _options(self):
        for so in self.specificationAttributeOptions:
            option = Option(so._id, so.ParentSpecificationAttrOptionId, so.Name) 
            self.alloptions.append(option)

            if  option.parentId in (None, ''):
                option.names.append(Spec(name=option.name,id=option.id))
                self.alltrees.append(option)

    def _trees(self, parents:list[Option]):
        #economicalCars = [car for car in carsList if car.price <= 1000000]
        for tree in parents:
            if tree.name == 'iPad':
                aa = 1
                
            childs = [child for child in self.alloptions if child.parentId == tree.id]
            
            if not childs:
                #return None
                continue
            
            for child in childs:
                child.parent = tree
                child.names = tree.names.copy()
                child.names.append(Spec(name=child.name,id=child.id))
                child.name = tree.name + ' ' + child.name

            tree.childs = childs
            self._trees(tree.childs)

def chek_so_name(name, soname)->Spec:
    sa = check_specificationattribute_by_name(soname)
    retSoName = Spec()
    seret = ''

    specificationAttributeOptions = sa.SpecificationAttributeOptions
    trees = Options(specificationAttributeOptions)    
    #trees = createTree(specificationAttributeOptions)

    for tree in trees.alltrees:
        sename = get_sename(name.replace(' ', ''))
        for a in trees.find_childs(tree):
            seson = get_sename(a.name.replace(' ', ''))
            if sename.find(seson) >= 0:
                if len(seson) > len(seret):
                    seret = seson
                    retSoName.name = a.name
                    retSoName.id = a.id
                    retSoName = retSoName if len(a.names) < 2 else a.names 
                    return retSoName
        
        seson = get_sename(tree.name.replace(' ', ''))
        if sename.find(seson) >= 0:
            if len(seson) > len(seret):
                seret = seson
                #retSoName = Spec(name=tree.name,id=tree.id)
                retSoName.name = tree.name
                retSoName.id = tree.id
                return retSoName
    
    return retSoName

def sorted_sa(f):
    return f['ParentSpecificationAttrOptionId']

def check_vendor(vendorName):
    new_v = Vendor().find_one({'Name': vendorName})
    if not new_v:
        new_v = Vendor(_id = str(ObjectId()), Name=vendorName, Email = "sales@"+vendorName)
        new_v.SeName = get_sename(vendorName, new_v._id, 'Vendor', '')
    
        if not new_v.is_created:
            new_v.commit()

    return new_v

def check_specificationattributeoption_by_name(prop_name, prop_value:Spec, color_hex = None, parentSPO = None):
    sa = check_specificationattribute_by_name(prop_name)
    
    sao_ret = None
    if sa.SpecificationAttributeOptions:
        for ind, a in enumerate(sa.SpecificationAttributeOptions):
            if prop_value.id in (None,''):
                if a.Name.lower().strip() == prop_value.name.lower().strip():
                    sao_ret = sa.SpecificationAttributeOptions[ind]
            else:
                if a._id == prop_value.id:
                    sao_ret = sa.SpecificationAttributeOptions[ind]

    if not sao_ret:
        sao_ret = SpecificationAttributeOption(_id = str(ObjectId()), Name = prop_value.name, ParentSpecificationAttrOptionId = '' if parentSPO == None else parentSPO)
        sao_ret.SeName = get_sename(prop_value, sao_ret._id, 'SpecificationAttributeOption', '')

        if not color_hex is None:
            sao_ret.ColorSquaresRgb = color_hex

        sa.SpecificationAttributeOptions.append(sao_ret)
        sa.commit()
    return sao_ret

def check_productspecificationattributeoption(p, sa, sao):
    psao_ret = None

    for ind, a in enumerate(p.ProductSpecificationAttributes):
        if a.SpecificationAttributeId == sa._id and a.SpecificationAttributeOptionId == sao._id:
            psao_ret = p.ProductSpecificationAttributes[ind]
            #spOption = sa.Name

            do = 99 #if spOption.get('displayOrderOnTabProduct') is None else spOption.get('displayOrderOnTabProduct')

            p.ProductSpecificationAttributes[ind].AllowFiltering = _filteringAtribute.__contains__(sa.Name)
            p.ProductSpecificationAttributes[ind].ShowOnProductPage = True
            p.ProductSpecificationAttributes[ind].ShowOnSellerPage = True
            p.ProductSpecificationAttributes[ind].DisplayOrder = do

            break

    if psao_ret is None:
        new_psao = ProductSpecificationAttributeRel(_id = str(ObjectId()),
                                    SpecificationAttributeId = sa._id,
                                    SpecificationAttributeOptionId = sao._id,
                                    AllowFiltering = _filteringAtribute.__contains__(sa.Name))
        p.ProductSpecificationAttributes.append(new_psao)


    return

def check_specificationattribute_by_name(prop_name:str):   
    do = 99 if not _filteringAtribute.__contains__(prop_name) else 0 

    sa = SpecificationAttribute().find_one({'Name': prop_name})
    
    if not sa:
        sa = SpecificationAttribute(_id = str(ObjectId()),
                                    Name = prop_name,
                                    DisplayOrder = do, 
                                    Locales = get_locals(prop_name))
        sa.commit()
    return sa

def get_locals(prop_name):
    lngs = Language.find({})
    locals = []
    
    if prop_name is None:
        return None
    
    for l in lngs:
        new_lng = Locale(LanguageId = l._id, LocaleKey = 'Name', LocaleValue = prop_name)
        locals.append(new_lng)

    return locals

def check_mainproduct(d:DataScraps):   
    p_main = Product.find_one({'Sku': d.sku, 'VendorId': ''})
    if not p_main:
        groupTemplateId = ProductTemplate.find_one({'Name': 'Grouped product (with variants)'})

        p_main = create_product(d)
        p_main.Url = ''
        p_main.ShortDescription = ''
        p_main.VendorId = ''
        p_main.ProductTemplateId = groupTemplateId.id if groupTemplateId else None
        p_main.SeName = get_sename(p_main.Sku, p_main._id, 'Product', '')
        p_main.VisibleIndividually = True
        p_main.ProductTypeId = 10

        category = Category().find_one({'Name':d.category})
        if category:
            newCategory = ProductCategoryRel(_id = str(ObjectId()), CategoryId = category._id)
            p_main.ProductCategories.append(newCategory)

    p_main.Name = d.name
    check_rel_manufacturers_to_product(p_main, d.manufacturer)
    return p_main

def check_сategories(c_name):
    c_main = Category().find_one({'Name': c_name})
    
    if not c_main:
        c_main = Category(_id = str(ObjectId()), Name = c_name)
        c_main.SeName = get_sename(c_name, c_main._id, 'Category', '')
        if not c_main.is_created:
            c_main.commit()

    return c_main

def check_rel_сategories_to_product(p:Product, c_name):
    cat_ret = None
    cat = p.ProductCategories
    cat = cat if cat else []

    c = check_сategories(c_name)
    
    for ind, cr in enumerate(cat):
        if cr.CategoryId == c._id:
            cat_ret = cat[ind]

    if cat_ret is None:
        #cat_ret = add_rel_сategories_to_product(p, c, cat)
        productCategoryRel = ProductCategoryRel(_id = str(ObjectId()), CategoryId = c._id)
        p.ProductCategories.append(productCategoryRel)


def get_file_picture_name(pictureId:str) -> str:
        CURR_DIR = os.getcwd()
        CURR_DIR = CURR_DIR.replace('\\Python.Script', '')
        file_catalog = '{0}\\Grand.Web\\wwwroot\\content\\images\\'.format(CURR_DIR)
        
        try:
            os.stat(file_catalog)
        except:
            os.mkdir(file_catalog)

        return '{0}{1}_0.jpeg'.format(file_catalog, pictureId)

def check_picture(pictureId, urlimage, productname):
    picture = Picture.find_one({'UrlImage': urlimage})
    
    if not picture:
        id_ = str(ObjectId())
        filename = get_file_picture_name(id_)
        load_image(urlimage, filename)

        in_file = open(filename, "rb")  # opening for [r]eading as [b]inary
        data = in_file.read()  # if you only wanted to read 512 bytes, do .read(512)
        in_file.close()

        p = Picture.find_one({'_id': pictureId})

        if p:
            if p.PictureBinary == data:
                picture = p
                if os.path.exists(filename):
                    os.remove(filename)

        if not picture:
            picture = Picture(_id = id_, 
                             PictureBinary = data,
                             SeoFilename = get_sename(productname),
                             UrlImage = urlimage,
                             AltAttribute = productname,
                             TitleAttribute = productname)
            
            picture.commit()
    return picture

def check_image_to_product(p, urlimage):
    pict_ret = None
    pName = p.Name
    for ind, pictFP in enumerate(p.ProductPictures):
        pictureId = pictFP.PictureId
        picture = check_picture(pictureId, urlimage, pName)
        if pictureId == picture._id:
            pict_ret = p.ProductPictures[ind]

    if not pict_ret:
        picture = check_picture('', urlimage, p.Name)
        new_rel = ProductPicture(_id = str(ObjectId()),
                            PictureId = picture._id,
                            SeoFilename = get_sename(p.Name),
                            AltAttribute = p.Name,
                            TitleAttribute = p.Name)
        p.ProductPictures.append(new_rel)

def check_manufacturers(manufacturer):

    if type(manufacturer) is str:
        brandname = manufacturer
        brandimg = None
    else:
        brandname = manufacturer.get('brand')
        brandimg = manufacturer.get('brandimg')

    if brandname is None:
        brandname = manufacturer

    #m_main = find_document(collaction, {'Name': brandname})
    m_main = Manufacturer.find_one({'Name': brandname})
    
    pictureId = None
    if not brandimg is None:
        pId = ''
        if not m_main is None:
            pId = m_main.PictureId if not m_main.PictureId is None else ''

        picture = check_picture(pId, brandimg, brandname)
        pictureId = picture._id

    if not m_main:
        m_main = Manufacturer(_id = str(ObjectId()),
                              Name=brandname, 
                              ManufacturerTemplateId = ManufacturerTemplate.find_one({}).id,
                              PictureId = pictureId)
        
        m_main.SeName = get_sename(brandname, m_main._id, 'Manufacturer', '')
        m_main.commit()
    else:
        if not pictureId is None:
            m_main.PictureId = pictureId
            m_main.commit()

    return m_main

def check_rel_manufacturers_to_product(p, m_name):
    mun_ret = None
    man = p.ProductManufacturers
    man = man if not man is None else []
    m_id = m_name.id
    
    if not m_id:
        name = m_name.name
        if name:
            m = check_manufacturers()
            m_id = m._id

    for ind, mr in enumerate(man):
        if mr.ManufacturerId == m_id:
            mun_ret = man[ind]

    if mun_ret is None:
        new_rel = ProductManufacturerRel(_id = str(ObjectId()), ManufacturerId = m_id)
        p.ProductManufacturers.append(new_rel) 

def create_product(d:DataScraps):
    
    curTierPrice = TierPrice(Price=d.price)
   
    deliveryDateId = DeliveryDate.find_one({})
    taxCategoryId = TaxCategory.find_one({})
    warehouseId = Warehouse.find_one({})
    unitId = MeasureUnit.find_one({})

    product_card = Product(_id = str(ObjectId()),
                            Name = d.name,
                            ShortDescription = d.url,
                            Url = d.url,
                            Sku = d.sku,
                            DeliveryDateId = None if not deliveryDateId else deliveryDateId.id ,
                            TaxCategoryId = None if not taxCategoryId else taxCategoryId.id,
                            WarehouseId = None if not warehouseId else warehouseId.id,
                            Price = d.price,
                            OldPrice = d.oldprice,
                            UnitId = None if not unitId else unitId.id,
                            TierPrices = [curTierPrice],
                            ProductCategories = [],
                            ProductManufacturers = [],
                            ProductPictures = [],
                            ProductSpecificationAttributes = []
                           )

    return product_card

def load_image(url,filename):
    if not os.path.exists(filename):
        urlretrieve(url, filename)

def clear_all_product(categoryName):
    category = Category.find_one({'Name':categoryName})
    if category:
        products = Product.find({'ProductCategories':{ '$elemMatch': {'CategoryId':category._id}}})

        for product in products:
            for picture in product.ProductPictures:
                p = Picture.find_one({'_id': picture.PictureId})            
                if not p is None:
                    p.delete()

                filename = get_file_picture_name(picture.PictureId)
                if os.path.exists(filename):
                    os.remove(filename)
            
            url = UrlRecord.find_one({'EntityName': 'Product', 'Slug': product.SeName})
            if not url is None:
                url.delete()
            
            productsRel = Product.find({'ParentGroupedProductId':product._id})
            for pRel in productsRel:
                print('Deleted releted product id = {0}, {1}',pRel._id,pRel.Name)
                pRel.delete()
            print('Deleted product id = {0}, {1}',product._id, product.Name)
            product.delete()

    #ads = find_document(db.Ad, {}, multiple = True)
    #for ad in ads:
        #delete_document(db.Ad, {'_id': ad.get('_id')})

    #PrivateMessages = find_document(db.PrivateMessage, {}, multiple = True)
    PrivateMessages = PrivateMessage.find({})
    for pm in PrivateMessages:
        #delete_document(db.PrivateMessage, {'_id': pm.get('_id')})
        pm.delete()

def get_sename(sename, entityId = None, entityName = None, languageId = None):
    #replacechar = [' ', '-', '!', '?', ':', '"', '.', '+']
    okChars = "abcdefghijklmnopqrstuvwxyz1234567890 _-"
    okRuChars = "abcdefghijklmnopqrstuvwxyzабвгдеёжзийлкмнопрстуфхцчшщъыьэюя1234567890 _-"
    senamenew_ru = sename.lower().replace('і', 'i')
    senamenew_ru = senamenew_ru.replace('є', 'e')
    senamenew_ru = senamenew_ru.replace('ї', 'i')
    senamenew_ru = senamenew_ru.replace('"', '_inch_')
    senamenew_ru = senamenew_ru.replace('+', '_plus_')
    senamenew_ru = senamenew_ru.replace('-', '_minus_')
    sename_new = ''

    for s in senamenew_ru:
        if okRuChars.__contains__(s):
            sename_new = sename_new + s

    senamenew_ru = sename_new

    senamenew_ru = pytils.translit.translify(senamenew_ru.strip()).lower()

    sename_new = ''
    for s in senamenew_ru:
        if okChars.__contains__(s):
            sename_new = sename_new + s

    sename_new = sename_new.replace(' ', '-')
    sename_new = sename_new.replace('--', '-')
    sename_new = sename_new.replace('__', '_')

    if not entityId is None:
        if not UrlRecord.find_one({'EntityId': entityId, 'EntityName': entityName, 'LanguageId': languageId}):
            
            for udel in UrlRecord.find({'Slug': sename_new, 'EntityName': entityName}):
                udel.delete()

            urlrecord = UrlRecord(_id = str(ObjectId()),
                                EntityId=entityId,
                                EntityName=entityName,
                                Slug=sename_new,
                                LanguageId=languageId)
            
            if not urlrecord.is_created:
                urlrecord.commit()
    return sename_new

def clear_spec():
    specAtrs = SpecificationAttribute().find()
    for sa in specAtrs:
        odels = []
        for option in sa.SpecificationAttributeOptions:
            if option.Name in (sa.Name, None, ''):
                if sa.Name == 'model':
                    q =1
                odels.append(option)
        
        for odel in odels:
            sa.SpecificationAttributeOptions.remove(odel)

        sa.commit()