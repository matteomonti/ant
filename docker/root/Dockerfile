FROM ubuntu:xenial

ADD setup.sh /root/setup.sh
RUN /bin/bash /root/setup.sh

ENV PATH /usr/local/clang_6.0.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV LD_LIBRARY_PATH /usr/local/clang_6.0.0/lib

ENV CXX clang++
ENV CC clang
