leaflet.projwmts 
========

Leaflet wmts layer with projection

### Usage ###

Download or clone this repo, then build it with:
```
npm install
gulp build
```
### Example ###
to run example localy with live-server:
```
npm serve
```
if everything is ok, new browser windows should be opened with directory listing, then go to
```
eexamples/wmts.html
```
or
```
examples/wmts_ortho.html
```
In examples EPSG:2180 is used, but it should work with diffrent CRS.

To properly configure wmts projection you have to define crs first like:
```javascript
var crs = new L.Proj.CRS(
    "EPSG:2180",
    "+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 units=m +no_defs",
    {}
);
```
then you can pass it to wmts layer, you have to copy tileSize, origin, scales and tilematrixSet values from service capabilities (url + '?service=WMTS&request=GetCapabilities')
:
```javascript
L.tileLayer.projwmts('https://mapy.geoportal.gov.pl/wss/service/WMTS/guest/wmts/G2_MOBILE_500', {
        crs: crs,
		format: 'image/png',
		tileSize: 512,
		version: '1.0.0',
		transparent: true,
        origin:[850000.0,100000.0],
        scales:[30238155.714285716,15119077.857142858,7559538.928571429,3779769.4642857146,1889884.7321428573,944942.3660714286,472471.1830357143,236235.59151785716,94494.23660714286,47247.11830357143,23623.559151785714,9449.423660714287,4724.711830357143,1889.8847321428573,944.9423660714286,472.4711830357143],
        tilematrixSet: 'EPSG:2180',
        opacity:1.0,
        crossOrigin:true,
        minZoom:5
    })
```
If you are using map service from diffrent domain then remember to set in layer options
```javascript
crossOrigin: true
```
