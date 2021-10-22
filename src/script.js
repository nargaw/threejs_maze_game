import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
const canvas = document.querySelector('.webgl')

class NewScene{
    constructor(){
        this._Init()
    }
    
    _Init(){
        this.scene = new THREE.Scene()
        this.clock = new THREE.Clock()
        this.v = new THREE.Vector3()
        this.oldElapsedTime = 0
        this.forwardVel = 0
        this.rightVel = 0
        this.objectsToUpdate = []
        this.keyMap = {}
        this.hoverMap = {}
        this.hoverTouch = {}
        this.thrusting = false
        this.logEvents = false
        this.tpCache = new Array()
        this.InitCarControls()
        this.InitPhysics()
        this.InitPhysicsDebugger()
        this.InitEnv()
        this.InitCamera()
        this.InitCar()
        this.InitMaze()
        this.InitLights()
        this.InitRenderer()
        this.InitControls()
        window.addEventListener('resize', () => {
            this.Resize()
            this.renderer.render(this.scene, this.camera)
        })
        document.addEventListener('keydown', this.onDocumentKey, false)
        document.addEventListener('keyup', this.onDocumentKey, false)
        document.addEventListener('touchstart', this.onDocumentTouch, {passive: false} )
        document.addEventListener('touchend', this.onDocumentTouch, {passive: false}, false)
        document.addEventListener('mouseover', this.onDocumentHover, false)
        document.addEventListener('mouseout', this.onDocumentHover, false)
        this.Update()
    }

    InitCarControls(){
        this.onDocumentKey = (e) => {
            this.keyMap[e.key] = e.type === 'keydown'
        }
        this.onDocumentHover = (e) => {
            e.preventDefault()
            this.hoverMap[e.target.id] = e.type === 'mouseover'
        }
        this.onDocumentTouch = (e) => {
            e.preventDefault()
            if (e.targetTouches.length == 2){
                for ( let i = 0; i < e.targetTouches.length; i++){
                    this.tpCache.push(e.targetTouches[i]);
                }
            }
            if(this.logEvents) log('touchStart', e, true)
            this.hoverTouch[e.target.id] = e.type === 'touchstart'
        }
    }

    InitPhysics(){
        this.world = new CANNON.World()
        this.world.gravity.set(0, -40, 0)
        this.defaultMaterial = new CANNON.Material('default')
        this.defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0.1,
                restitution: 0.2
            }
        )
        this.world.defaultContactMaterial = this.defaultContactMaterial
        this.world.addContactMaterial(this.defaultContactMaterial)
    }

    InitPhysicsDebugger(){
        cannonDebugger(
            this.scene,
            this.world.bodies,
            {
                color: 0x00ff00,
                autoUpdate: true
            }
        )
    }

    InitEnv(){
        this.fog = new THREE.FogExp2(0x191919, 0.001)
        this.scene.fog = this.fog
        this.geometry = new THREE.PlaneBufferGeometry(1100, 1100, 2, 2)
        this.material = new THREE.MeshStandardMaterial({
            
            })
        this.ground = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({
            color: 0xee9b00
        }))
        this.scene.add(this.ground)
        this.ground.rotation.x = -Math.PI * 0.5
        this.ground.receiveShadow = true

        //physics
        this.groundBody = new CANNON.Body({
            mass: 0,
            material: this.defaultMaterial
        })
        this.world.addBody(this.groundBody)
        this.groundBody.addShape(new CANNON.Plane())
        this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
    }

    InitCar(){
        this.group = new THREE.Group()
        this.carMaterial = new THREE.MeshStandardMaterial({ color: 0x780000 })
        this.box = new THREE.Mesh(new THREE.BoxBufferGeometry(1, 1, 2),  this.carMaterial)
        this.topBox = new THREE.Mesh(new THREE.BoxBufferGeometry(0.5, 0.5, 0.5),  this.carMaterial)
        this.poleFront = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.1, 0.1, 1.5), this.carMaterial)
        this.poleBack = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.1, 0.1, 1.5),  this.carMaterial)
        this.group.add(this.poleFront)
        this.group.add(this.poleBack)
        this.group.add(this.box)
        this.group.add(this.topBox)
        this.topBox.position.set(0, 0.5, 0)
        this.poleFront.rotation.x = -Math.PI * 0.5
        this.poleFront.rotation.z = -Math.PI * 0.5
        this.poleFront.position.set(0.0, -0.5, -1.0)
        this.poleBack.rotation.x = -Math.PI * 0.5
        this.poleBack.rotation.z = -Math.PI * 0.5
        this.poleBack.position.set(0.0, -0.5, 1.0)
        
        this.scene.add(this.group)
        this.group.add(this.chaseCam)
        this.group.position.set(0, 4, 0)

        this.carBodyShape = new CANNON.Box(new CANNON.Vec3(1, 0.25, 1.5))
        this.carBody = new CANNON.Body({
            mass: 40,
            material: this.defaultMaterial
        })
        this.carBody.addShape(this.carBodyShape)
        this.world.addBody(this.carBody)
        this.carBody.position.copy(this.box.position)
        this.carBody.angularDamping = 0.9
        this.objectsToUpdate.push({
            mesh: this.group,
            body: this.carBody
        })

        this.wheelGeometry = new THREE.CylinderBufferGeometry(0.33, 0.33, 0.2)
        this.wheelGeometry.rotateZ(Math.PI * 0.5)
        //Left Front Wheel
        this.wheelsFL = new THREE.Mesh(this.wheelGeometry,  this.carMaterial)
        this.scene.add(this.wheelsFL)
        this.wheelsFL.position.set(-1, 3, -1)
        this.wheelsFLShape = new CANNON.Sphere(0.33)
        this.wheelsFLBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsFLBody.addShape(this.wheelsFLShape)
        this.wheelsFLBody.position.copy(this.wheelsFL.position)
        this.world.addBody(this.wheelsFLBody)
        this.wheelsFLBody.angularDamping = 0.4
        this.wheelsFLBody.applyLocalForce = 20
        this.objectsToUpdate.push({
            mesh: this.wheelsFL,
            body: this.wheelsFLBody
        })
        
        
        //Right Front Wheel
        this.wheelsFR = new THREE.Mesh(this.wheelGeometry,  this.carMaterial)
        this.scene.add(this.wheelsFR)
        this.wheelsFR.position.set(1, 3, -1)
        this.wheelsFRShape = new CANNON.Sphere(0.33)
        this.wheelsFRBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsFRBody.addShape(this.wheelsFRShape)
        this.wheelsFRBody.position.copy(this.wheelsFR.position)
        this.world.addBody(this.wheelsFRBody)
        this.wheelsFRBody.angularDamping = 0.4
        this.wheelsFRBody.applyLocalForce = 20
        this.objectsToUpdate.push({
            mesh: this.wheelsFR,
            body: this.wheelsFRBody
        })

        //Left Back Wheel
        this.wheelsBL = new THREE.Mesh(this.wheelGeometry,  this.carMaterial)
        this.scene.add(this.wheelsBL)
        this.wheelsBL.position.set(-1, 3, 1)
        this.wheelsBLShape = new CANNON.Sphere(0.4)
        this.wheelsBLBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsBLBody.addShape(this.wheelsBLShape)
        this.wheelsBLBody.position.copy(this.wheelsBL.position)
        this.world.addBody(this.wheelsBLBody)
        this.wheelsBLBody.angularDamping = 0.4
        this.objectsToUpdate.push({
            mesh: this.wheelsBL,
            body: this.wheelsBLBody
        })

        //Right Back Wheel
        this.wheelsBR = new THREE.Mesh(this.wheelGeometry,  this.carMaterial)
        this.scene.add(this.wheelsBR)
        this.wheelsBR.position.set(1, 3, 1)
        this.wheelsBRShape = new CANNON.Sphere(0.4)
        //this.wheelsBRShape = new CANNON.Cylinder(0.4, 0.4, 0.4)
        this.wheelsBRBody = new CANNON.Body({
            mass: 1,
            material: this.defaultMaterial
        })
        this.wheelsBRBody.addShape(this.wheelsBRShape)
        this.wheelsBRBody.position.copy(this.wheelsBR.position)
        this.world.addBody(this.wheelsBRBody)
        this.wheelsBRBody.angularDamping = 0.4
        this.objectsToUpdate.push({
            mesh: this.wheelsBR,
            body: this.wheelsBRBody
        })

        //constraints
        this.FLaxis = new CANNON.Vec3(1, 0, 0)
        this.FRaxis = new CANNON.Vec3(1, 0, 0)
        this.BLaxis = new CANNON.Vec3(1, 0, 0)
        this.BRaxis = new CANNON.Vec3(1, 0, 0)
        this.constraintFL = new CANNON.HingeConstraint(this.carBody, this.wheelsFLBody, {
            pivotA: new CANNON.Vec3(-0.75, -0.5, -1),
            axisA: this.FLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFL)

        this.constraintFR = new CANNON.HingeConstraint(this.carBody, this.wheelsFRBody, {
            pivotA: new CANNON.Vec3(0.75, -0.5, -1),
            axisA: this.FRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFR)

        this.constraintBL = new CANNON.HingeConstraint(this.carBody, this.wheelsBLBody, {
            pivotA: new CANNON.Vec3(-0.75, -0.5, 1),
            axisA: this.BLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBL)

        this.constraintBR = new CANNON.HingeConstraint(this.carBody, this.wheelsBRBody, {
            pivotA: new CANNON.Vec3(0.75, -0.5, 1),
            axisA: this.BRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBR)
        this.constraintBL.enableMotor()
        this.constraintBR.enableMotor()
    }

    InitMaze(){
        InitMaze(){
        this.mazeMaterial = new THREE.MeshStandardMaterial({
            
        })
        this.gltfLoader = new GLTFLoader()
        this.gltfLoader.load(
            'maze2.glb',
            (gltf) => {
                gltf.scene.scale.set(80, 50, 80)
                gltf.scene.position.set(0, -10, 0)
                gltf.scene.traverse((child) => {
                    if((child).isMesh){
                        this.gltfMesh = child
                        this.gltfMesh.receiveShadow = true
                        this.gltfMesh.castShadow = true
                        this.gltfMesh.material = this.mazeMaterial
                    }
                    
                })
                this.scene.add(gltf.scene)
            }
        )

        //bulding physics
        this.buildingBody = new CANNON.Body({
            mass: 0,
            material: this.defaultMaterial
        })
        //this.buildingShape = new CANNON.Box(new CANNON.Vec3(500, 20, 5))
        this.buildingBody.addShape(this.buildingShape)
        this.buildingBody.position.set(0, 25, 478)
        this.world.addBody(this.buildingBody)
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 500)), new CANNON.Vec3(-475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 500)), new CANNON.Vec3(475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(500, 20, 5)), new CANNON.Vec3(0, 0, -950))


        
        
    }
        
    }
    
    InitRenderer(){
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
        })
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.render(this.scene, this.camera)
    }

    InitCamera(){
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000)
        this.camera.position.set(0, 500, 500 )
        this.scene.add(this.camera)
        this.chaseCam = new THREE.Object3D()
        this.chaseCam.position.set(0, 0, 0)
        this.chaseCamPivot = new THREE.Object3D()
        this.chaseCamPivot.position.set(0, 2, 4)
        this.chaseCam.add(this.chaseCamPivot)
        this.scene.add(this.chaseCam)
    }

    InitLights(){
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
        this.scene.add(this.ambientLight)
        this.pointLight = new THREE.PointLight(0xffffff, 1.2)
        this.scene.add(this.pointLight)
        this.pointLight.position.set(20, 50, 20)
        this.pointLight.castShadow = true
        this.pointLight.shadow.mapSize.width = 1024;
        this.pointLight.shadow.mapSize.height = 1024;
        this.headLight = new THREE.PointLight(0xffffff, 1, 5, 1)
        this.headLight.position.set(0, 0.25, -3)
        this.group.add(this.headLight)
    }

    InitControls(){
        this.controls = new OrbitControls(this.camera, canvas)
        this.controls.enableDamping = true
        this.controls.update()
    }

    Resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    Update(){
        requestAnimationFrame(() => {     
            this.elapsedTime = this.clock.getElapsedTime()
            this.deltaTime = this.elapsedTime - this.oldElapsedTime
            this.oldElapsedTime = this.elapsedTime
            this.world.step(1/60, this.oldElapsedTime, 3)

            this.camera.lookAt(this.group.position)

            this.chaseCamPivot.getWorldPosition(this.v)
            if (this.v.y < 1){
                this.v.y = 1
            }
            //this.camera.position.lerpVectors(this.camera.position, this.v, 0.1)
            for(this.object of this.objectsToUpdate){
                this.object.mesh.position.copy(this.object.body.position)
                this.object.mesh.quaternion.copy(this.object.body.quaternion)
            }
            this.thrusting = false

            if (this.keyMap['w'] || this.hoverMap['3']  || this.hoverTouch['3']|| this.keyMap['ArrowUp']){
                if(this.forwardVel < 12.5){
                    this.forwardVel += 0.5
                    this.thrusting = true
                } 
            }

            if (this.keyMap['s'] || this.hoverMap['4'] || this.hoverTouch['4'] || this.keyMap['ArrowDown']){
                if(this.forwardVel > -5.0){
                    this.forwardVel -= 1
                    this.thrusting = true 
                } 
            }

            if (this.keyMap['a'] || this.hoverMap['1'] || this.hoverTouch['1']|| this.keyMap['ArrowLeft']){
                if(this.rightVel > -0.5){
                    this.rightVel -= 0.025
                } 
            }

            if (this.keyMap['d'] || this.hoverMap['2'] || this.hoverTouch['2']|| this.keyMap['ArrowRight']){
                if(this.rightVel < 0.5){
                    this.rightVel += 0.025
                } 
            }
            if (this.keyMap[' ']){
                if(this.forwardVel > 0){
                    this.forwardVel -= 1
                }
                if(this.forwardVel < 0){
                    this.forwardVel += 1
                }
            }

            if (!this.thrusting || !this.getPos){
                if (this.forwardVel > 0){
                    this.forwardVel -= 0.25
                }
                if(this.forwardVel < 0){
                    this.forwardVel += 0.25
                }
                if(this.rightVel > 0){
                    this.rightVel -= 0.01
                }
                if(this.rightVel < 0){
                    this.rightVel += 0.01
                }
            }
            this.constraintBL.setMotorSpeed(this.forwardVel)
            this.constraintBR.setMotorSpeed(this.forwardVel)
            this.constraintFL.axisA.z = this.rightVel
            this.constraintFR.axisA.z = this.rightVel

            this.renderer.render(this.scene, this.camera)
            this.controls.update()
            this.Update()
        })  
    }
}

let _APP = null

window.addEventListener('DOMContentLoaded', () => {
    _APP = new NewScene()
})
