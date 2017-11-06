import fs from "fs";
import os from "os";
import readPkg from "read-pkg";
import semver from "semver";

import Package from "../../src/Package";

const toPackage = (ref) => {
  return ref instanceof Package
    ? ref
    : new Package(readPkg.sync(ref), ref);
}

const matchBinaryLinks = () => {
  return (pkgRef, raw) => {
    const pkg = toPackage(pkgRef);

    const inputs = Array.isArray(raw) ? raw : [raw];

    const links = os.platform() === "win32"
      ? inputs.reduce((acc, input) => [...acc, input, [input, 'cmd'].join('.')], [])
      : inputs;

    const expectation = `expected ${pkg.name} to link to ${links.join(', ')}`;

    const found = fs.readdirSync(pkg.binLocation);
    const missing = links.filter(link => !found.includes(link));
    const superfluous = found.filter(link => !links.includes(link));

    if (missing.length > 0 || superfluous.length > 0) {
      return {
        message: [
          expectation,
          missing.length > 0 ? `missing: ${missing.join(', ')}` : '',
          superfluous.length > 0 ? `superfluous: ${superfluous.join(', ')}` : ''
        ].filter(Boolean).join(' '),
        pass: false
      };
    }

    return {
      message: expectation,
      pass: true
    };
  };
};

const matchDependency = dependencyType => {
  return (manifest, pkg, range) => {
    const noDeps = typeof manifest[dependencyType] !== 'object';
    const id = [pkg, range].filter(Boolean).join('@');
    const verb = dependencyType === 'dependencies'
      ? 'depend'
      : 'dev-depend';

    const expectation = `expected ${manifest.name} to ${verb} on ${id}`;
    const json = JSON.stringify(manifest[dependencyType], null, '  ');

    if (noDeps) {
      return {
        message: `${expectation} but no .${dependencyType} specified`,
        pass: false
      }
    }

    const missingDep = !(pkg in manifest[dependencyType]);

    if (missingDep) {
      return {
        message: `${expectation} but it is missing from .${dependencyType}\n${json}`,
        pass: false
      };
    }

    const version = manifest[dependencyType][pkg];
    const mismatchedDep = range ? !semver.intersects(version, range) : false;

    if (mismatchedDep) {
      return {
        message: `${expectation} but ${version} does not satisfy ${range}\n${json}`,
        pass: false
      };
    }

    return {
      message: expectation,
      pass: true
    };
  }
};

export default {
  toDependOn: matchDependency('dependencies'),
  toDevDependOn: matchDependency('devDependencies'),
  toBinaryLink: matchBinaryLinks()
}
