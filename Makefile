image="pmkr/arch"
vimg="./tmp/virtual.img"
mount_dir="/media/tmp"

setup:
	@(cd docker; docker build -t ${image} .) && \
  ./scripts/make-virtual-image ${vimg}

mount:
	@mkdir -p ${mount_dir}; mount -t ext4 -o loop ${vimg} ${mount_dir}

umount:
	@umount ${mount_dir}; rm -r ${mount_dir}

shell:
	@docker run -it --rm --net host -v `pwd`:/app --workdir /app --privileged ${image} /bin/bash

.PHONY: setup mount umount shell
