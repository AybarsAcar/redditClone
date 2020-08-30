#!/bin/bash

echo What should the version be?
read VERSION

docker build -t aybars/lireddit:$VERSION
docker push aybars/lireddit:$VERSION
ssh root@64.227.13.208 "docker pull aybars/lireddit:$VERSION && docker tag aybars/lireddit:$VERSION dokku/api:$VERSION && dokku deploy api $VERSION"