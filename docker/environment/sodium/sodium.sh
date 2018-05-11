#!/bin/bash

apt-get update
apt-get upgrade
apt-get install -y wget

cd

wget -nv https://download.libsodium.org/libsodium/releases/LATEST.tar.gz
tar xzvf LATEST.tar.gz

cd libsodium-stable
./configure
make
make install

cd

rm LATEST.tar.gz
rm -r libsodium-stable

apt-get remove -y wget

rm sodium.sh
