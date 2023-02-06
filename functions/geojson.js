const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client')
const turf = require('@turf/turf');
const geojsonReducer = require('geojson-reducer');
const prisma = new PrismaClient()

exports.handler = async (event, context, callback) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT
        dimb_ig,
        string_agg(plz, ',') as plz
      FROM
        dimb_ig_ms_teams
      WHERE bundesland = 'Baden-Württemberg'
      AND dimb_ig != 'N.N.'
      GROUP BY
        dimb_ig;
    `;
    await prisma.dimb_ig.deleteMany();
    const geoJson = [];
    await result.reduce(async (lastPromise, item) => {
      const accum = await lastPromise;
      const { dimb_ig, plz } = item;
      const area = plz.split(',');
      const items = await prisma.opendatasoft_plz_germany.findMany({
        where: {
          plz_code: { in: area },
        }
      });
      const geoJsonFeatures = items.map((item) => item.geometry);
      let geometry = {
          "type": "FeatureCollection",
          "features": geoJsonFeatures,
      };
      try {
        geometry = turf.dissolve(geometry);
        geometry = geojsonReducer.reduceGeoJson(JSON.stringify(geometry));
        geometry.features.forEach((geometryItem) => {
          geoJson.push(geometryItem);
        })
        await prisma.dimb_ig.create({
          data: {
            id: uuidv4(),
            name: dimb_ig,
            geometry,
          }
        });
        console.log(dimb_ig);
      } catch (error) {
        console.log(error);
      }
      return [...accum, items];
    }, Promise.resolve([]));
    await prisma.dimb_ig.create({
      data: {
        id: uuidv4(),
        name: 'DIMB',
        geometry: {
          "type": "FeatureCollection",
          "features": geoJson,
        },
      }
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    }
  } catch (error) {
    console.error(error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(error)
    }
  }
}
