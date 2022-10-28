// So someone just autoinstalled a module
// they didn't specific a version number
// The auto installer needs to do something like:
// If there's no @latest installed in the repo, download the latest and save it (as @latested and @x.y.z)
// Otherwise, check the latest remote version of the module
// If it's more recent than what's in the repo's _latest, then download and update
