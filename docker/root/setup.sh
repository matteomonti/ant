#!/bin/bash

apt-get update
apt-get upgrade
apt-get install -y xz-utils wget build-essential

cd

wget http://releases.llvm.org/6.0.0/clang+llvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04.tar.xz
tar xvfJ clang+llvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04.tar.xz
mv clang+llvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04 /usr/local/clang_6.0.0

apt-get remove -y xz-utils wget

rm clang+llvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04.tar.xz
rm setup.sh
