ol.proj.proj4.register(proj4);
//ol.proj.get("EPSG:32651").setExtent([362873.712903, 1909147.838864, 377845.203615, 1919546.501524]);
var wms_layers = [];


        var lyr_OSMStandard_0 = new ol.layer.Tile({
            'title': 'OSM Standard',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' &nbsp &middot; <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors, CC-BY-SA</a>',
                url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
        });

        var lyr_GoogleSatellite_1 = new ol.layer.Tile({
            'title': 'Google Satellite',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' &nbsp &middot; <a href="https://www.google.at/permissions/geoguidelines/attr-guide.html">Map data ©2015 Google</a>',
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
            })
        });

        var lyr_Positron_2 = new ol.layer.Tile({
            'title': 'Positron',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' &nbsp &middot; <a href="https://cartodb.com/basemaps/">Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.</a>',
                url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            })
        });
var lyr_27_3 = new ol.layer.Image({
        opacity: 1,
        
    title: '27<br />\
    <img src="styles/legend/27_3_0.png" /> 0<br />\
    <img src="styles/legend/27_3_1.png" /> 14.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/27_3.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_26_4 = new ol.layer.Image({
        opacity: 1,
        
    title: '26<br />\
    <img src="styles/legend/26_4_0.png" /> 0<br />\
    <img src="styles/legend/26_4_1.png" /> 13.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/26_4.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_25_5 = new ol.layer.Image({
        opacity: 1,
        
    title: '25<br />\
    <img src="styles/legend/25_5_0.png" /> 0<br />\
    <img src="styles/legend/25_5_1.png" /> 12.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/25_5.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_24_6 = new ol.layer.Image({
        opacity: 1,
        
    title: '24<br />\
    <img src="styles/legend/24_6_0.png" /> 0<br />\
    <img src="styles/legend/24_6_1.png" /> 11.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/24_6.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_23_7 = new ol.layer.Image({
        opacity: 1,
        
    title: '23<br />\
    <img src="styles/legend/23_7_0.png" /> 0<br />\
    <img src="styles/legend/23_7_1.png" /> 10.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/23_7.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_22_8 = new ol.layer.Image({
        opacity: 1,
        
    title: '22<br />\
    <img src="styles/legend/22_8_0.png" /> 0<br />\
    <img src="styles/legend/22_8_1.png" /> 9.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/22_8.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_21_9 = new ol.layer.Image({
        opacity: 1,
        
    title: '21<br />\
    <img src="styles/legend/21_9_0.png" /> 0<br />\
    <img src="styles/legend/21_9_1.png" /> 8.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/21_9.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var lyr_20_10 = new ol.layer.Image({
        opacity: 1,
        
    title: '20<br />\
    <img src="styles/legend/20_10_0.png" /> 0<br />\
    <img src="styles/legend/20_10_1.png" /> 7.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/20_10.png",
            attributions: ' ',
            projection: 'EPSG:32651',
            alwaysInRange: true,
            imageExtent: [355517.500000, 1902872.500000, 383027.500000, 1933772.500000]
        })
    });
var group_FloodExtentinMeters = new ol.layer.Group({
                                layers: [lyr_27_3,lyr_26_4,lyr_25_5,lyr_24_6,lyr_23_7,lyr_22_8,lyr_21_9,lyr_20_10,],
                                fold: 'open',
                                title: 'Flood Extent in Meters'});

lyr_OSMStandard_0.setVisible(true);lyr_GoogleSatellite_1.setVisible(true);lyr_Positron_2.setVisible(true);lyr_27_3.setVisible(true);lyr_26_4.setVisible(true);lyr_25_5.setVisible(true);lyr_24_6.setVisible(true);lyr_23_7.setVisible(true);lyr_22_8.setVisible(true);lyr_21_9.setVisible(true);lyr_20_10.setVisible(true);
var layersList = [lyr_OSMStandard_0,lyr_GoogleSatellite_1,lyr_Positron_2,group_FloodExtentinMeters];
