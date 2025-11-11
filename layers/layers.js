var wms_layers = [];


        var lyr_Positron_0 = new ol.layer.Tile({
            'title': 'Positron',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' &nbsp &middot; <a href="https://cartodb.com/basemaps/">Map tiles by CartoDB, under CC BY 3.0. Data by OpenStreetMap, under ODbL.</a>',
                url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
            })
        });
var lyr_25_1 = new ol.layer.Image({
        opacity: 1,
        
    title: '25<br />\
    <img src="styles/legend/25_1_0.png" /> 0.0<br />\
    <img src="styles/legend/25_1_1.png" /> 4.2<br />\
    <img src="styles/legend/25_1_2.png" /> 8.3<br />\
    <img src="styles/legend/25_1_3.png" /> 12.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/25_1.png",
            attributions: ' ',
            projection: 'EPSG:3857',
            alwaysInRange: true,
            imageExtent: [13540812.333586, 1944840.685012, 13569836.761757, 1977593.206324]
        })
    });
var lyr_30_2 = new ol.layer.Image({
        opacity: 1,
        
    title: '30<br />\
    <img src="styles/legend/30_2_0.png" /> 0.0<br />\
    <img src="styles/legend/30_2_1.png" /> 4.2<br />\
    <img src="styles/legend/30_2_2.png" /> 8.3<br />\
    <img src="styles/legend/30_2_3.png" /> 12.5<br />' ,
        
        
        source: new ol.source.ImageStatic({
            url: "./layers/30_2.png",
            attributions: ' ',
            projection: 'EPSG:3857',
            alwaysInRange: true,
            imageExtent: [13540812.333586, 1944840.685012, 13569836.761757, 1977593.206324]
        })
    });
var group_FloodExtentmeters = new ol.layer.Group({
                                layers: [lyr_25_1,lyr_30_2,],
                                fold: 'open',
                                title: 'Flood Extent (meters)'});

lyr_Positron_0.setVisible(true);lyr_25_1.setVisible(true);lyr_30_2.setVisible(true);
var layersList = [lyr_Positron_0,group_FloodExtentmeters];
