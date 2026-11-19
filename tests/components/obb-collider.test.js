/* global assert, suite, test */
import * as THREE from 'three';

function createScene () {
  var scene = document.createElement('a-scene');
  document.body.appendChild(scene);
  return new Promise(resolve => {
    if (scene.hasLoaded) { return resolve(scene); }
    scene.addEventListener('loaded', () => resolve(scene));
  });
}

function boxEl (position, geometry) {
  var el = document.createElement('a-entity');
  el.setAttribute('position', position);
  el.setAttribute('geometry', geometry || 'primitive: box; width: 1; height: 1; depth: 1');
  return el;
}

function assertVec (actual, expected, message) {
  assert.closeTo(actual.x, expected.x, 0.0001, message + ' (x) actual ' + JSON.stringify(actual) + ' expected ' + JSON.stringify(expected));
  assert.closeTo(actual.y, expected.y, 0.0001, message + ' (y) actual ' + JSON.stringify(actual) + ' expected ' + JSON.stringify(expected));
  assert.closeTo(actual.z, expected.z, 0.0001, message + ' (z) actual ' + JSON.stringify(actual) + ' expected ' + JSON.stringify(expected));
}

suite('obb-collider', function () {
  test('collider is centered on the geometry inside a rotated entity', function (done) {
    var scene;
    var group;
    var box;
    createScene().then(_scene => {
      scene = _scene;
      group = document.createElement('a-entity');
      group.setAttribute('position', '0 1 0');
      group.setAttribute('rotation', '0 90 0');
      group.setAttribute('obb-collider', '');
      box = boxEl('2 0 0');
      group.appendChild(box);
      scene.appendChild(group);
      return new Promise(resolve => {
        group.addEventListener('loaded', resolve);
        if (group.hasLoaded) { resolve(); }
      });
    }).then(() => {
      var component = group.components['obb-collider'];
      scene.tick(0, 16);

      assertVec(component.obb.center, {x: 0, y: 1, z: -2}, 'collider center');
      assertVec(component.obb.halfSize, {x: 0.5, y: 0.5, z: 0.5}, 'collider half size');
      assertVec(box.object3D.getWorldPosition(new THREE.Vector3()), {x: 0, y: 1, z: -2}, 'box world position');
      // The group origin itself is not inside the collider.
      assert.notOk(component.obb.containsPoint(new THREE.Vector3(0, 1, 0)));
      assert.ok(component.obb.containsPoint(box.object3D.getWorldPosition(new THREE.Vector3())));
      done();
    }).catch(done);
  });

  test('collider accounts for parent rotation and scale and keeps the hierarchy intact', function (done) {
    var scene;
    var stage;
    var group;
    var box;
    createScene().then(_scene => {
      scene = _scene;
      stage = document.createElement('a-entity');
      stage.setAttribute('position', '0 0 -3');
      stage.setAttribute('rotation', '0 0 90');
      stage.setAttribute('scale', '2 2 2');
      group = document.createElement('a-entity');
      group.setAttribute('position', '0 1 0');
      group.setAttribute('rotation', '0 90 0');
      group.setAttribute('obb-collider', '');
      box = boxEl('2 0 0');
      group.appendChild(box);
      stage.appendChild(group);
      scene.appendChild(stage);
      return new Promise(resolve => {
        group.addEventListener('loaded', resolve);
        if (group.hasLoaded) { resolve(); }
      });
    }).then(() => {
      var component = group.components['obb-collider'];
      component.showCollider();
      scene.tick(0, 16);

      assertVec(component.obb.center, {x: -2, y: 0, z: -7}, 'collider center');
      assertVec(component.obb.halfSize, {x: 1, y: 1, z: 1}, 'collider half size');
      assertVec(box.object3D.getWorldPosition(new THREE.Vector3()), {x: -2, y: 0, z: -7}, 'box world position');

      var meshPosition = new THREE.Vector3();
      component.renderColliderMesh.matrixWorld.decompose(meshPosition, new THREE.Quaternion(), new THREE.Vector3());
      assertVec(meshPosition, {x: -2, y: 0, z: -7}, 'collider mesh center');
      assert.ok(component.obb.containsPoint(box.object3D.getWorldPosition(new THREE.Vector3())));

      // Nothing in the scene graph got moved by computing the collider.
      assertVec(box.object3D.position, {x: 2, y: 0, z: 0}, 'box local position');
      assertVec(stage.object3D.position, {x: 0, y: 0, z: -3}, 'stage local position');
      assert.closeTo(stage.object3D.rotation.z, Math.PI / 2, 0.0001, 'stage rotation z');
      assertVec(stage.object3D.scale, {x: 2, y: 2, z: 2}, 'stage scale');
      done();
    }).catch(done);
  });

  test('user defined size keeps the collider centered on the entity origin', function (done) {
    var scene;
    createScene().then(_scene => {
      scene = _scene;
      var el = boxEl('4 0 0');
      el.setAttribute('obb-collider', 'size: 0.4');
      scene.appendChild(el);
      return new Promise(resolve => {
        el.addEventListener('loaded', resolve);
        if (el.hasLoaded) { resolve(); }
      });
    }).then(() => {
      scene.tick(0, 16);
      var el = scene.querySelector('[obb-collider]');
      var component = el.components['obb-collider'];
      assertVec(component.obb.center, {x: 4, y: 0, z: 0}, 'collider center');
      assertVec(component.obb.halfSize, {x: 0.2, y: 0.2, z: 0.2}, 'collider half size');
      done();
    }).catch(done);
  });

  test('flat centered plate gets the minimum collider thickness without moving', function (done) {
    var scene;
    var el;
    createScene().then(_scene => {
      scene = _scene;
      el = boxEl('6 0 0', 'primitive: box; width: 1; height: 0.001; depth: 1');
      el.setAttribute('obb-collider', '');
      scene.appendChild(el);
      return new Promise(resolve => {
        el.addEventListener('loaded', resolve);
        if (el.hasLoaded) { resolve(); }
      });
    }).then(() => {
      scene.tick(0, 16);
      var component = el.components['obb-collider'];
      assertVec(component.obb.center, {x: 6, y: 0, z: 0}, 'collider center');
      assertVec(component.obb.halfSize, {x: 0.5, y: 0.01, z: 0.5}, 'collider half size');
      done();
    }).catch(done);
  });

  test('collider mesh is drawn around the collider center', function (done) {
    var scene;
    var group;
    createScene().then(_scene => {
      scene = _scene;
      group = document.createElement('a-entity');
      group.setAttribute('position', '0 1 0');
      group.setAttribute('rotation', '0 90 0');
      group.setAttribute('obb-collider', '');
      group.appendChild(boxEl('2 0 0'));
      scene.appendChild(group);
      return new Promise(resolve => {
        group.addEventListener('loaded', resolve);
        if (group.hasLoaded) { resolve(); }
      });
    }).then(() => {
      var component = group.components['obb-collider'];
      component.showCollider();
      scene.tick(0, 16);
      var meshPosition = new THREE.Vector3();
      component.renderColliderMesh.matrixWorld.decompose(meshPosition, new THREE.Quaternion(), new THREE.Vector3());
      assertVec(meshPosition, {x: 0, y: 1, z: -2}, 'collider mesh center');
      assertVec(component.obb.center, meshPosition, 'collider and mesh centers match');
      done();
    }).catch(done);
  });

  test('collision events keep the tracked object when the collision ends', function (done) {
    var scene;
    var first;
    var second;
    var startedDetail;
    var endedDetail;
    createScene().then(_scene => {
      scene = _scene;
      first = boxEl('0 3 0');
      first.setAttribute('obb-collider', 'trackedObject3D: object3D');
      second = boxEl('0.4 3 0');
      second.setAttribute('obb-collider', 'trackedObject3D: object3D');
      first.addEventListener('obbcollisionstarted', function (evt) {
        if (evt.detail.withEl === second) { startedDetail = evt.detail; }
      });
      first.addEventListener('obbcollisionended', function (evt) {
        if (evt.detail.withEl === second) { endedDetail = evt.detail; }
      });
      scene.appendChild(first);
      scene.appendChild(second);
      return new Promise(resolve => {
        second.addEventListener('loaded', resolve);
        if (second.hasLoaded) { resolve(); }
      });
    }).then(() => {
      first.components['obb-collider'].checkTrackedObject();
      second.components['obb-collider'].checkTrackedObject();
      scene.tick(0, 16);
      assert.ok(startedDetail, 'collision started');
      assert.strictEqual(startedDetail.trackedObject3D, first.object3D);

      second.setAttribute('position', '8 3 0');
      scene.tick(0, 16);
      assert.ok(endedDetail, 'collision ended');
      assert.strictEqual(endedDetail.withEl, second);
      assert.strictEqual(endedDetail.trackedObject3D, first.object3D);
      done();
    }).catch(done);
  });
});
