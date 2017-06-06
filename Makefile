image="pmkr/arch"
vimg="./tmp/virtual.img"

setup:
	@(cd docker; docker build -t ${image} .) && \
  ./scripts/make-virtual-image ${vimg}

add-loop:
	@losetup /dev/loop0 ${vimg}

rm-loop:
	@losetup -d /dev/loop0

shell:
	@docker run -it --rm --net host -v `pwd`:/app --workdir /app --privileged ${image} /bin/bash

install:
	@node bin/install

.PHONY: setup mount umount shell
