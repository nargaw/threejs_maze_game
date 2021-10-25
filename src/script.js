import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import fragment from './shaders/fragment.glsl'
import vertex from './shaders/vertex.glsl'
import { sRGBEncoding } from 'three'
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
        this.InitFireFlies()
        this.InitCamera()
        this.InitCar()
        this.InitText()
        this.InitSound()
        this.InitMaze()
        this.InitPumpkins()
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

    InitSound(){
        this.audioOne = new Audio('scarecrow.mp3')
        this.audioTwo = new Audio('werewolf.mp3')
        this.playSound = () => {
            this.audioOne.volume = 0.05
            this.audioOne.currentTime = 0
            this.audioOne.autoplay = true
            this.audioOne.play()
            this.audioOne.loop = true
        }
        setInterval(() => {
            this.audioTwo.volume = 0.1
            this.audioTwo.currentTime = 0
            this.audioTwo.autoplay = true
            this.audioTwo.play()  
        }, 15000)
        // this.playWerewoflSound = () => {
        //     setTimeout(() =>{
        //         this.audioTwo.volume = Math.random()
        //         this.audioTwo.currentTime = 0
        //         this.audioTwo.autoplay = true
        //         this.audioTwo.play()
        //     }, 10000)
        // }
        this.playSound()
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
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)
        //this.world.allowSleep = true
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

    InitFireFlies(){
        this.firefliesGeometry = new THREE.BufferGeometry()
        this.firefliesCount = 100000
        this.positionArray = new Float32Array(this.firefliesCount * 3)
        this.scaleArray = new Float32Array(this.firefliesCount)
        for(let i = 0; i < this.firefliesCount; i++){
            this.positionArray[i * 3 + 0] = (Math.random() - 0.5) * 1000
            this.positionArray[i * 3 + 1] = (Math.random()) * 1000
            this.positionArray[i * 3 + 2] = (Math.random() - 0.5) * 1000

            this.scaleArray[i] = Math.random()
        }
        this.firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3))
        this.firefliesGeometry.setAttribute('aScale', new THREE.BufferAttribute(this.scaleArray, 1))

        this.firefliesMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0},
                u_pixelRatio: { value: Math.min(window.devicePixelRatio, 2)},
                u_size: { value: 1000 }
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
        this.fireflies = new THREE.Points(this.firefliesGeometry, this.firefliesMaterial)
        this.scene.add(this.fireflies)
    }

    InitEnv(){
        this.fog = new THREE.FogExp2(0x000000, 0.005)
        this.scene.fog = this.fog
        this.geometry = new THREE.PlaneBufferGeometry(1100, 1100, 2, 2)
        this.material = new THREE.MeshStandardMaterial({
            color: 0xf77f00
        })
        this.ground = new THREE.Mesh(this.geometry, this.material)
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
        this.box = new THREE.Mesh(new THREE.BoxBufferGeometry(5, 3, 8),  this.carMaterial)
        this.topBox = new THREE.Mesh(new THREE.BoxBufferGeometry( 3,  3,  3),  this.carMaterial)
        this.poleFront = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.3, 6.5), this.carMaterial)
        this.poleBack = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.3, 0.3, 6.5),  this.carMaterial)
        this.group.add(this.poleFront)
        this.group.add(this.poleBack)
        this.group.add(this.box)
        this.group.add(this.topBox)
        this.topBox.position.set(0, 1.5, 0)
        this.poleFront.rotation.x = -Math.PI * 0.5
        this.poleFront.rotation.z = -Math.PI * 0.5
        this.poleFront.position.set(0.0, -0.5, -3.0)
        this.poleBack.rotation.x = -Math.PI * 0.5
        this.poleBack.rotation.z = -Math.PI * 0.5
        this.poleBack.position.set(0.0, -0.5, 3.0)

        
        this.scene.add(this.group)
        this.group.add(this.chaseCam)
        this.group.position.set(0, 0, 450)

        this.carBodyShape = new CANNON.Box(new CANNON.Vec3(1 * 3, 0.25 * 3, 1.5 * 3))
        this.carBody = new CANNON.Body({
            mass: 40,
            material: this.defaultMaterial
        })
        this.carBody.addShape(this.carBodyShape)
        this.world.addBody(this.carBody)
        this.carBody.position.copy(this.group.position)
        this.carBody.angularDamping = 0.9
        this.objectsToUpdate.push({
            mesh: this.group,
            body: this.carBody
        })

        this.wheelGeometry = new THREE.CylinderBufferGeometry(0.99, 0.99, 0.6)
        this.wheelGeometry.rotateZ(Math.PI * 0.5)
        //Left Front Wheel
        this.wheelsFL = new THREE.Mesh(this.wheelGeometry,  this.carMaterial)
        this.scene.add(this.wheelsFL)
        this.wheelsFL.position.set(-3, 3, 449)
        this.wheelsFLShape = new CANNON.Sphere(0.4 * 3)
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
        this.wheelsFR.position.set(3, 3, 449)
        this.wheelsFRShape = new CANNON.Sphere(0.4 * 3)
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
        this.wheelsBL.position.set(-3, 3, 450.5)
        this.wheelsBLShape = new CANNON.Sphere(0.4 * 3)
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
        this.wheelsBR.position.set(3, 3, 450.5)
        this.wheelsBRShape = new CANNON.Sphere(0.4 * 3)
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
            pivotA: new CANNON.Vec3(-3, -0.5, -3),
            axisA: this.FLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFL)

        this.constraintFR = new CANNON.HingeConstraint(this.carBody, this.wheelsFRBody, {
            pivotA: new CANNON.Vec3(3, -0.5, -3),
            axisA: this.FRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintFR)

        this.constraintBL = new CANNON.HingeConstraint(this.carBody, this.wheelsBLBody, {
            pivotA: new CANNON.Vec3(-3, -0.5, 3),
            axisA: this.BLaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBL)

        this.constraintBR = new CANNON.HingeConstraint(this.carBody, this.wheelsBRBody, {
            pivotA: new CANNON.Vec3(3, -0.5, 3),
            axisA: this.BRaxis,
            maxForce: 13
        })
        this.world.addConstraint(this.constraintBR)
        this.constraintBL.enableMotor()
        this.constraintBR.enableMotor()
    }

    InitPumpkins(){
        this.pumpkinMaterial = new THREE.MeshStandardMaterial({ color: 0xff7518 })
        this.loadPumpkin = () => {
            this.gltfLoader.load(
            'pumpkin2.glb',
            (gltf) => {
                gltf.scene.scale.set(5, 5, 5)
                gltf.scene.position.set(0, 0, 0)
                gltf.scene.traverse((child) => {
                if((child).isMesh){
                    this.gltfMesh = child
                    this.gltfMesh.receiveShadow = true
                    this.gltfMesh.castShadow = true
                    this.gltfMesh.material = this.pumpkinMaterial
                }
                    
                })
                this.scene.add(gltf.scene)
                gltf.scene.position.set(Math.random()*150 -75, 0, Math.random() * 100 - 50)

                this.pumpkinBody = new CANNON.Body({
                        mass: 0.2,
                        material: this.defaultMaterial
                    })
                this.pumpkinShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.1, 1))
                this.pumpkinBody.addShape(this.pumpkinShape)
                this.pumpkinBody.addShape(new CANNON.Sphere(0.3 * 2.5))
                this.pumpkinBody.position.copy(gltf.scene.position)
                //this.buildingBody.position.set(0, 18, 475)
                this.world.addBody(this.pumpkinBody)
                this.objectsToUpdate.push({
                    mesh: gltf.scene,
                    body: this.pumpkinBody
                })
            }
        )
        }
        for(let i = 0; i <= 100; i++){
            this.loadPumpkin()
        }
        
    }

    InitMaze(){
        this.g 
        this.mazeMaterial = new THREE.MeshStandardMaterial({
            //side: THREE.DoubleSide
            color: 0x003049
        })
        this.gltfLoader = new GLTFLoader()
        this.gltfLoader.load(
            'maze2.glb',
            (gltf) => {
                //console.log(gltf)
                gltf.scene.scale.set(80, 50, 80)
                gltf.scene.position.set(0, -10, 0)
                gltf.scene.traverse((child) => {
                    if((child).isMesh){
                        this.gltfMesh = child
                        this.gltfMesh.receiveShadow = true
                        this.gltfMesh.castShadow = true
                        this.gltfMesh.material = this.mazeMaterial
                        this.g = this.gltfMesh
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
        this.buildingShape = new CANNON.Box(new CANNON.Vec3(500, 25, 5))
        this.buildingBody.addShape(this.buildingShape)
        this.buildingBody.position.set(0, 18, 475)
        this.world.addBody(this.buildingBody)
       //borders
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 25, 500)), new CANNON.Vec3(-475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 25, 500)), new CANNON.Vec3(475, 1, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(500, 25, 5)), new CANNON.Vec3(0, 0, -950))

        //horizontal
        //r1
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.5 , 20, 5)), new CANNON.Vec3(-365, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/1.7 , 20, 5)), new CANNON.Vec3(-225, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.65 , 20, 5)), new CANNON.Vec3(-90, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 * 1.60 , 20, 5)), new CANNON.Vec3(225, 0, -43))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 , 20, 5)), new CANNON.Vec3(390, 0, -43))

        //r2
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.5, 20, 5)), new CANNON.Vec3(-458, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-270, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-180, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 2, 20, 5)), new CANNON.Vec3(-70, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(90, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(270, 0, -43.3 * 2))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(410, 0, -43.3 * 2))

        //r3
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 4.0, 20, 5)), new CANNON.Vec3(-390, 0, -45.3 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(-228, 0, -44.9 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 2, 20, 5)), new CANNON.Vec3(25, 0, -44.9 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 4.85, 20, 5)), new CANNON.Vec3(272, 0, -44.5 * 3))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 5)), new CANNON.Vec3(452, 0, -44.9 * 3))

        //r4
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(-295, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(-182, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(-45, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 6.72, 20, 4.5)), new CANNON.Vec3(180, 0, -44.8 * 4))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(408, 0, -44.8 * 4))

        //r5
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(-386, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80, 20, 4.5)), new CANNON.Vec3(-270, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 4.5)), new CANNON.Vec3(-92, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80, 20, 4.5)), new CANNON.Vec3(45, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.80 * 2, 20, 4.5)), new CANNON.Vec3(295, 0, -44.8 * 5))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.65, 20, 4.5)), new CANNON.Vec3(408, 0, -44.8 * 5))

        //r6
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-318, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(-182, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-45, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.85 * 3, 20, 5)), new CANNON.Vec3(135, 0, -44.8 * 6))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.92 * 4, 20, 5)), new CANNON.Vec3(340, 0, -44.8 * 6))

        //r7
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(-275, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(-90, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.86 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45 * 7))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(452, 0, -45 * 7))

        //r8
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.84 * 2, 20, 5)), new CANNON.Vec3(-296, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(318, 0, -45 * 8))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45 * 8))

        //r9
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-364, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-272, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.7, 20, 5)), new CANNON.Vec3(-184, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(250, 0, -45 * 9))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45 * 9))

        //r10
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.88 * 3, 20, 5)), new CANNON.Vec3(-364, 0, -45 * 10))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/1.88 * 4, 20, 5)), new CANNON.Vec3(340, 0, -45 * 10))

        //r11
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.87 * 3, 20, 5)), new CANNON.Vec3(-319, 0, -45 * 11))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(205, 0, -45 * 11))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 2.0 * 3, 20, 5)), new CANNON.Vec3(368, 0, -45 * 11))

        //r12
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-228, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45 * 12))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45 * 12))

        //r13
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.75 * 2, 20, 5)), new CANNON.Vec3(-295, 0, -45.2 * 13))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.6, 20, 5)), new CANNON.Vec3(-185, 0, -45.2 * 13))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3 / 1.75 * 2, 20, 5)), new CANNON.Vec3(385, 0, -45.2 * 13))


        //r14
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.87 * 3, 20, 5)), new CANNON.Vec3(-364, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-228, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 8, 20, 5)), new CANNON.Vec3(21, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(318, 0, -45.2 * 14))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45.2 * 14))

        //r15
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-275, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-185, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-25, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(180, 0, -45.2 * 15))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(430, 0, -45.2 * 15))
        
        //r16
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-410, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-320, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 10, 20, 5)), new CANNON.Vec3(-23, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(294, 0, -45.2 * 16))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(455, 0, -45.2 * 16))

        //r17
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.9 * 4, 20, 5)), new CANNON.Vec3(-295, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-137, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45.2 * 17))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(340, 0, -45.2 * 17))

        //r18
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.95 * 5, 20, 5)), new CANNON.Vec3(-321, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-22, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 3, 20, 5)), new CANNON.Vec3(135, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(295, 0, -45.2 * 18))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(408, 0, -45.2 * 18))

        //r19
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-455, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-320, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.85 * 4, 20, 5)), new CANNON.Vec3(-115, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(68, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(205, 0, -45.2 * 19))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(453, 0, -45.2 * 19))

        //r20
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-365, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.8 * 2, 20, 5)), new CANNON.Vec3(-250, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-135, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.6, 20, 5)), new CANNON.Vec3(-45, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.86 * 3, 20, 5)), new CANNON.Vec3(90, 0, -45.2 * 20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(45.3/ 1.86 * 4, 20, 5)), new CANNON.Vec3(340, 0, -45.2 * 20))

        //vertical
        //c1
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + 43, 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + 43, 0, -270))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4 / 1.88)), new CANNON.Vec3(-475 + 43, 0, -451))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.9)), new CANNON.Vec3(-475 + 43, 0, -614))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + 43, 0, -768))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.9)), new CANNON.Vec3(-475 + 43, 0, -885))

        //c2
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -202))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/1.8)), new CANNON.Vec3(-475 + (44 * 2), 0, -315))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/1.85)), new CANNON.Vec3(-475 + (44 * 2), 0, -563))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/1.7)), new CANNON.Vec3(-475 + (44 * 2), 0, -700))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/1.85)), new CANNON.Vec3(-475 + (44 * 2), 0, -888))

        //c3
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -110))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -290))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -383))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45/ 1.6)), new CANNON.Vec3(-475 + (44 * 3), 0, -560))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3 / 1.85)), new CANNON.Vec3(-475 + (44 * 3), 0, -700))

        //c4
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -245))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -429))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -520))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 4), 0, -882))

        //c5
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -133))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -384))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4 / 1.9)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -632))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.7)), new CANNON.Vec3(-475 + (44.8 * 5), 0, -835))

        //c6
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -225))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -360))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2 / 1.8)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -495))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -745))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 6), 0, -882))

        //c7
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -155))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 7/ 1.75)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -490))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.75)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -815))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (44.8 * 7), 0, -928))

        //c8
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/ 1.9)), new CANNON.Vec3(-475 + (45 * 8), 0, -155))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -292))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -700))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -792))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 8), 0, -882))

        //c9
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -110))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -246))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -656))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -790))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45 * 9), 0, -925))

        //c10
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -178))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -290))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 10), 0, -745))

        //c11
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 3/ 1.9)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -245))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 11), 0, -814))

        //c12
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -88))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -248))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 12), 0, -678))

        //c13
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -20))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -178))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.1 * 13), 0, -838))

        //c14
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -88))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -248))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 7/ 2.0)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -475))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 14), 0, -883))

        //c15
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 4/ 1.9)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -361))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -587))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -769))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.3 * 15), 0, -930))

        //c16
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -316))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 6/ 1.9)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -585))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -788))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 16), 0, -885))

        //c17
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -380))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -634))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.6)), new CANNON.Vec3(-475 + (45.2 * 17), 0, -838))

        //c18
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -42))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -385))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -587))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -698))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -788))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 18), 0, -885))

        //c19
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 19), 0, -107))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 19), 0, -201))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -360))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -722))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.2 * 19), 0, -860))

        //c20
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -65))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -156))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 20), 0, -292))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.2 * 20), 0, -478))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 / 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -610))
        this.buildingBody.addShape(new CANNON.Box(new CANNON.Vec3(5, 20, 45 * 2/ 1.8)), new CANNON.Vec3(-475 + (45.3 * 20), 0, -768))
        
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
        this.renderer.outputEncoding = THREE.sRGBEncoding
    }

    InitCamera(){
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000)
        this.camera.position.set(0, 45, 15 )
        this.scene.add(this.camera)
        this.chaseCam = new THREE.Object3D()
        this.chaseCam.position.set(0, 0, 0)
        this.chaseCamPivot = new THREE.Object3D()
        this.chaseCamPivot.position.set(0, 10, 12)
        this.chaseCam.add(this.chaseCamPivot)
        this.scene.add(this.chaseCam)
    }

    InitText(){
        this.fontLoader = new THREE.FontLoader()
        this.word = 'HAPPY HALLOWEEN'
        this.fontLoader.load(
            './Butcherman_Regular.json',
            (font) => {
                this.textParameters = {
                    font: font,
                    size: 8.0,
                    height: 3.2,
                    curveSegments: 12,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }
            
                for (let i = 0; i <= this.word.length -1; i++){
                    this.textGeometry = new THREE.TextGeometry(
                        this.word[i],
                        this.textParameters
                    )
                    this.textMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    this.text = new THREE.Mesh(this.textGeometry, this.textMaterial)
                    this.scene.add(this.text)
                    this.text.castShadow = true
                    this.textGeometry.computeBoundingBox()
                    this.textGeometry.center()
                    this.text.position.set(0, 0, -20)

                    this.boxShape = new CANNON.Box(new CANNON.Vec3(4.0, 4.5, 5.5))
                    this.boxBody = new CANNON.Body({
                    mass: 0.5, 
                    position: new CANNON.Vec3((i *12.0) - 80, 0, -60),
                    shape: this.boxShape,
                    material: this.ContactMaterial
                    })
                    this.world.addBody(this.boxBody)
                    this.objectsToUpdate.push({
                    mesh: this.text,
                    body: this.boxBody
                    }) 
                }
            }
        )
    }

    InitLights(){
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
        this.scene.add(this.ambientLight)
        this.pointLight = new THREE.PointLight(0xffffff, 0.5)
        this.scene.add(this.pointLight)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.1)
        //this.scene.add(this.directionalLight)
        this.directionalLight.position.set(0, 500, 500)
        this.pointLight.position.set(20, 50, 20)
        this.pointLight.castShadow = true
        this.pointLight.shadow.mapSize.width = 1024;
        this.pointLight.shadow.mapSize.height = 1024;
        this.headLight = new THREE.PointLight(0xffffff, 1.0,30, 1)
        this.headLight2 = new THREE.PointLight(0xffffff, 1.0,30, 1)
        this.headLightHelper = new THREE.PointLightHelper(this.headLight, 0xff00ff, 0.3)
        //this.group.add(this.headLightHelper)
        this.headLight.position.set(-1.5, 0.5,-10)
        this.headLight2.position.set(1.5, 0.5,-10)
        
        this.group.add(this.headLight)
        this.group.add(this.headLight2)
        this.headLight.rotation.x = Math.PI * 0.5
    }

    InitControls(){
        this.controls = new OrbitControls(this.camera, canvas)
        this.controls.enableDamping = true
        //this.controls.enablePan = true
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

            //this.camera.lookAt(this.group.position)

            this.chaseCamPivot.getWorldPosition(this.v)
            if (this.v.y < 3){
                this.v.y = 3
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

            //this.material.uniforms.u_time.value += this.clock.getDelta()
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
