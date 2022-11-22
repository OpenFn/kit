if [ -z "$1" ]; then
  echo "ERROR: Package name not defined!\n"
  echo "Try:"
  echo "   pnpm export adaptor-docs"
  exit 1
fi

echo "Building tarball"
echo "Building tarball for $1"

cd packages/$1
filename=$(pnpm run pack | tail -n 1)

echo "Installing into Lightning..."
# assumes lighting is a sibling
cd ../../../Lightning/assets
npm install ../../kit/dist/$filename

echo "\nDone!"