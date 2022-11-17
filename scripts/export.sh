echo "Building tarball for $1"

cd packages/$1
filename=$(pnpm run pack | tail -n 1)

echo $filename

# assumes lighting is a sibling
cd ../../../Lightning/assets
npm install ../../kit/dist/$filename