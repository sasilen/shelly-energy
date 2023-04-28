#!/usr/bin/python3
#from lxml import etree
import xml.etree.ElementTree as ET
import json
import sys
import urllib.request
from datetime import date, datetime, timedelta

ns = {"e": "urn:iec62325.351:tc57wg16:451-3:publicationdocument:7:0"}
token = sys.argv[1]
hourly_prices = {}

url = 'https://web-api.tp.entsoe.eu/api?securityToken=' + token + '&documentType=A44&in_Domain=10YFI-1--------U&out_Domain=10YFI-1--------U&periodStart=' + date.today().strftime('%Y%m%d1900') + '&periodEnd=' + (date.today() + timedelta(days=1)).strftime('%Y%m%d1900')
response = urllib.request.urlopen(url).read()
entso = ET.fromstring(response)
timeseries = entso.findall('e:TimeSeries',namespaces=ns)

for timeserie in timeseries:
    mrid = int(timeserie.find('e:mRID',namespaces=ns).text)-1

    for point in timeserie.findall('e:Period/e:Point',namespaces=ns):
        position = ("%02d" % int(point.find('e:position', namespaces=ns).text))
        if (int(position) < int(datetime.now().strftime('%H')) and mrid == 0) :
            continue
        price = point.find('e:price.amount', namespaces=ns).text
        hourly_prices[str(mrid) + '.' + str(position)] = { "price":str(price), "time":(date.today() + timedelta(days=mrid)).strftime('%Y%m%d'+position+'00') }

json = json.dumps(hourly_prices)
print(json)
