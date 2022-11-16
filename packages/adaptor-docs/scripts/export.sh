echo "Building tarball"

filename=$(pnpm run pack | tail -n 1)

echo $filename

# assumes lighting is a sibling
cd ../../../Lightning/assets
npm install ../../kit/dist/$filename