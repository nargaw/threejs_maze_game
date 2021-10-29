import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import Stats from 'stats.js'
import fragment from './firefliesShader/fragment.glsl'
import vertex from './firefliesShader/vertex.glsl'
const canvas = document.querySelector('.webgl')

class NewScene{
    constructor(){
        this._Init()
    }
    
    _Init(){
        
        this.scene = new THREE.Scene()
        this.clock = new THREE.Clock()
        this.v = new THREE.Vector3()
        this.birdeyeView = new THREE.Vector3(0, 60, 50)
        this.closeupView = new THREE.Vector3(0, 5, 12)
        this.oldElapsedTime = 0
        this.forwardVel = 0
        this.rightVel = 0
        this.objectsToUpdate = []
        this.pumpkinsToUpdate = []
        this.cams = [this.birdeyeView, this.closeupView]
        this.currentCam = this.birdeyeView
        this.pressMap = {}
        this.clickMap = {}
        this.keyMap = {}
        this.hoverMap = {}
        this.hoverTouch = {}
        this.thrusting = false
        this.logEvents = false
        this.tpCache = new Array()
    
        //this.InitStats()
        this.InitTextures()
        this.InitCarControls()
        this.InitPhysics()
        //this.InitPhysicsDebugger()
        this.InitEnv()
        this.InitFireFlies()
        this.InitCamera()
        this.InitPumpkins()
        this.InitCar()
        this.InitText()
        this.InitWelcomeText()
        this.InitSound()
        this.InitMaze()
        this.InitDirections()
        this.InitLights()
        this.InitRenderer()
        //this.InitControls()
        
        window.addEventListener('resize', () => {
            this.Resize()
            this.renderer.render(this.scene, this.camera)
        })
        document.addEventListener('click', this.onDocumentClick, false)
        document.addEventListener('keydown', this.onDocumentKey, false)
        document.addEventListener('keyup', this.onDocumentKey, false)
        document.addEventListener('touchstart', this.onDocumentTouch, {passive: false} )
        document.addEventListener('touchend', this.onDocumentTouch, {passive: false}, false)
        document.addEventListener('mouseover', this.onDocumentHover, false)
        document.addEventListener('mouseout', this.onDocumentHover, false)
        document.addEventListener('touchstart', this.onDocumentPress, {passive: false})
        this.Update()
    }

    InitStats(){
        this.stats = new Stats()
        this.stats.showPanel(0)
        document.body.appendChild(this.stats.dom)
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

        this.onDocumentClick = (e) => {
            e.preventDefault()
            this.clickMap[e.target.id] = e.type === 'click'
        }

        this.onDocumentPress = (e) => {
            e.preventDefault()
            this.pressMap[e.target.id] = e.type === 'touchstart'
        }
    }

    InitSound(){
        this.audioOne = new Audio('scarecrow.mp3')
        this.audioTwo = new Audio('werewolf.mp3')
        this.playSound = () => {
            this.audioOne.volume = 0.035
            this.audioOne.currentTime = 0
            this.audioOne.autoplay = true
            this.audioOne.play()
            this.audioOne.loop = true
        }
        setInterval(() => {
            this.audioTwo.volume = 0.025
            this.audioTwo.currentTime = 0
            this.audioTwo.autoplay = true
            this.audioTwo.play()  
        }, 15000)
        this.playSound()
    }

    //3d texutres (https://3dtextures.me/)
    InitTextures(){
        this.loadingManager = new THREE.LoadingManager()
        this.textureLoader = new THREE.TextureLoader(this.loadingManager)
        this.loadingManager.onStart= () => {
            //console.log('loading started')
        }
        this.loadingManager.onLoad = () => {
            //console.log('loading finsihed')
        }
        this.loadingManager.onProgress = () => {
           // console.log('loading in progress...')
        }
        this.loadingManager.onError = () => {
           // console.log('error occured')
        }

        this.pumpkinColorTexture = this.textureLoader.load('/pumpkin/baseColor.jpg')
        this.pumpkinAmbientOcclusionTexture = this.textureLoader.load('/pumpkin/ambientOcclusion.jpg')
        this.pumpkinHeightTexture = this.textureLoader.load('/pumpkin/height.png')
        this.pumpkinRoughnessTexture = this.textureLoader.load('/pumpkin/roughness.jpg')
        this.pumpkinNormalTexture = this.textureLoader.load('/pumpkin/normal.jpg')

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
        this.world.allowSleep = true
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
        this.firefliesCount = 10000
        this.positionArray = new Float32Array(this.firefliesCount * 3)
        this.scaleArray = new Float32Array(this.firefliesCount)
        for(let i = 0; i < this.firefliesCount; i++){
            this.positionArray[i * 3 + 0] = (Math.random() - 0.5) * 1000
            this.positionArray[i * 3 + 1] = (Math.random()) * 50
            this.positionArray[i * 3 + 2] = (Math.random() - 0.5) * 1000

            this.scaleArray[i] = Math.random()
        }
        this.firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(this.positionArray, 3))
        this.firefliesGeometry.setAttribute('aScale', new THREE.BufferAttribute(this.scaleArray, 1))

        this.firefliesMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_time: { value: 0},
                u_pixelRatio: { value: Math.min(window.devicePixelRatio, 2)},
                u_size: { value: 2000 }
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
        this.fog = new THREE.FogExp2(0x272640, 0.005)
        //this.scene.fog = this.fog
        this.geometry = new THREE.PlaneBufferGeometry(1100, 1100, 2, 2)
        this.material = new THREE.MeshStandardMaterial({
            color: 0x144552,
            side: THREE.DoubleSide
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

    InitPumpkins(){
        this.pumpkinGroup = new THREE.Group()
        this.scene.add(this.pumpkinGroup)  
        this.pumpkinGeometry = new THREE.TorusGeometry(1.25, 2.4, 14, 18, 6.3)
        this.pumpkinMaterial = new THREE.MeshStandardMaterial({ 
            map: this.pumpkinColorTexture,
            transparent: true,
            aoMap: this.pumpkinAmbientOcclusionTexture,
            displacementMap: this.pumpkinHeightTexture,
            displacementScale: 2,
            displacementBias: 1,
            normalMap: this.pumpkinNormalTexture,
            roughnessMap: this.pumpkinRoughnessTexture
            
        })

        
        this.pumpkinShape = new CANNON.Sphere(5)
        for (let i = 0; i <= 50; i++){
            this.angle = Math.random() * Math.PI * 2
            this.radius = 25 + Math.random() * 500
            this.x = Math.cos(this.angle) * this.radius
            this.z = Math.sin(this.angle) * this.radius

            this.pumpkin = new THREE.Mesh(this.pumpkinGeometry, this.pumpkinMaterial)
            
            
            this.pumpkinBody = new CANNON.Body({
                mass: 1,
                material: this.defaultMaterial,
                shape: this.pumpkinShape,
            })
            this.pumpkinBody.addShape(new CANNON.Box(new CANNON.Vec3(2.5, 5, 2.5)))
            this.pumpkinBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
            this.pumpkin.position.set(this.x, 100, this.z)
            this.pumpkin.rotation.x = -Math.PI * 0.5
            this.pumpkin.geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(this.pumpkin.geometry.attributes.uv.array, 2))

            this.pumpkinGroup.add(this.pumpkin)
            this.world.addBody(this.pumpkinBody)
            this.pumpkinBody.allowSleep = true
            this.pumpkinBody.position.copy(this.pumpkin.position)
            this.pumpkinsToUpdate.push({
                mesh: this.pumpkin,
                body: this.pumpkinBody
            })
            this.pumpkinBody.sleepSpeedLimit = 0.5
            
        } 
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
        this.carBody.addShape(new CANNON.Sphere(2.5), new CANNON.Vec3(0, 1.8, 0))
        this.carBody.addShape(this.carBodyShape)
        this.world.addBody(this.carBody)
        
        this.carBody.position.copy(this.group.position)
        this.carBody.angularDamping = 0.9
        this.objectsToUpdate.push({
            mesh: this.group,
            body: this.carBody
        })
        this.carBody.allowSleep = false
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
        this.wheelsFLBody.allowSleep = false
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
        this.wheelsFRBody.allowSleep = false
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
        this.wheelsBLBody.allowSleep = false
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
        this.wheelsBRBody.allowSleep = false
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

    InitDirections(){
        this.arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xee9b00,
            flatShading: true
        })
        
        
            this.gltfLoader.load(
            'arrow.glb',
            (gltf) => {
                gltf.scene.scale.set(15, 15, 15)
                gltf.scene.position.set(0, 5, 0)
                gltf.scene.traverse((child) => {
                if((child).isMesh){
                    this.gltfMesh = child
                    this.gltfMesh.receiveShadow = true
                    this.gltfMesh.castShadow = true
                    this.gltfMesh.material = this.arrowMaterial
                }
                    
                })
                this.arrowClone = gltf.scene.clone()
                this.arrowClone.scale.set(10, 15, 15)
                this.arrowClone.position.set(-75, 0, 403)
                this.scene.add(this.arrowClone)
                

                this.arrow2Clone = gltf.scene.clone()
                this.arrow2Clone.scale.set(10, 15, 15)
                this.arrow2Clone.position.set(-371, 30, 150)
                this.arrow2Clone.rotation.z = -Math.PI
                this.arrow2Clone.rotation.y = Math.PI * 0.5
                this.scene.add(this.arrow2Clone)

                this.arrow3Clone = gltf.scene.clone()
                this.arrow3Clone.scale.set(10, 15, 15)
                this.arrow3Clone.position.set(-325, 0, -3)
                this.scene.add(this.arrow3Clone)

                this.arrow4Clone = gltf.scene.clone()
                this.arrow4Clone.scale.set(10, 15, 15)
                this.arrow4Clone.rotation.y = -Math.PI * 0.5
                this.arrow4Clone.position.set(-358, 0, -210)
                this.scene.add(this.arrow4Clone)

                this.arrow5Clone = gltf.scene.clone()
                this.arrow5Clone.scale.set(10, 15, 15)
                this.arrow5Clone.rotation.y = -Math.PI * 0.5
                this.arrow5Clone.position.set(-85, 5, -335)
                this.scene.add(this.arrow5Clone)

                this.arrow6Clone = gltf.scene.clone()
                this.arrow6Clone.scale.set(10, 15, 15)
                this.arrow6Clone.position.set(310, 5, -265)
                //this.arrow6Clone.rotation.x = -Math.PI
                this.arrow6Clone.rotation.y = -Math.PI
                this.scene.add(this.arrow6Clone)

                this.arrow7Clone = gltf.scene.clone()
                this.arrow7Clone.scale.set(10, 15, 15)
                this.arrow7Clone.position.set(395, 25, -84)
                this.arrow7Clone.rotation.z = Math.PI
                this.arrow7Clone.rotation.y = -Math.PI
                this.scene.add(this.arrow7Clone)

                this.arrow8Clone = gltf.scene.clone()
                this.arrow8Clone.scale.set(10, 15, 15)
                this.arrow8Clone.position.set(275, 30, 145)
                this.arrow8Clone.rotation.z = Math.PI
                this.arrow8Clone.rotation.y = -Math.PI
                this.scene.add(this.arrow8Clone)

                this.arrow9Clone = gltf.scene.clone()
                this.arrow9Clone.scale.set(10, 15, 15)
                this.arrow9Clone.position.set(325, 25, 325)
                this.arrow9Clone.rotation.z = Math.PI
                this.arrow9Clone.rotation.y = -Math.PI
                this.scene.add(this.arrow9Clone)

            }
        )
        }
        

    InitMaze(){
        this.mazeMaterial = new THREE.MeshStandardMaterial({
            //side: THREE.DoubleSide
            color: 0x003049
        })
        this.gltfLoader = new GLTFLoader(this.loadingManager)
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
        //this.renderer.outputEncoding = THREE.sRGBEncoding
    }

    InitCamera(){
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 10000)
        this.camera.position.set(0, 505, 250 )
        this.scene.add(this.camera)
        this.chaseCam = new THREE.Object3D()
        this.chaseCam.position.set(0, 0, 0)
        this.chaseCamPivot = new THREE.Object3D()
        this.chaseCamPivot.position.copy(this.currentCam)
        this.chaseCam.add(this.chaseCamPivot)
        this.scene.add(this.chaseCam)
    }

    InitText(){
        this.fontLoader = new THREE.FontLoader()
        this.word = 'HAPPY'
        this.word2 = 'HALLOWEEN'
        this.fontLoader.load(
            './EricaOne.json',
            (font) => {
                this.textParameters = {
                    font: font,
                    size: 16.0,
                    height: 6,
                    curveSegments: 2,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }
            
               
                this.textGeometry = new THREE.TextGeometry(
                    this.word,
                    this.textParameters
                )
                this.textMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
                this.text = new THREE.Mesh(this.textGeometry, this.textMaterial)
                this.scene.add(this.text)
                this.text.castShadow = true
                this.textGeometry.computeBoundingBox()
                this.textGeometry.center()
                this.text.position.set(0, 0, 0)

                this.boxShape = new CANNON.Box(new CANNON.Vec3(40, 7.5, 5))
                this.boxBody = new CANNON.Body({
                mass: 200, 
                position: new CANNON.Vec3(0, 30, 0),
                shape: this.boxShape,
                material: this.ContactMaterial
                })
                this.world.addBody(this.boxBody)
                this.boxBody.allowSleep = true
                this.objectsToUpdate.push({
                mesh: this.text,
                body: this.boxBody
                })
                
                this.text2Geometry = new THREE.TextGeometry(
                    this.word2,
                    this.textParameters
                )
                this.text2 = new THREE.Mesh(this.text2Geometry, this.textMaterial)
                this.scene.add(this.text2)
                this.text2Geometry.computeBoundingBox()
                this.text2Geometry.center()
                this.box2Shape = new CANNON.Box(new CANNON.Vec3(68, 7.5, 5))
                this.box2Body = new CANNON.Body({
                mass: 20, 
                position: new CANNON.Vec3(0, 10, 0),
                shape: this.box2Shape,
                material: this.ContactMaterial
                })
                this.world.addBody(this.box2Body)
                this.box2Body.allowSleep = true
                this.objectsToUpdate.push({
                mesh: this.text2,
                body: this.box2Body
                })    
            }
        )
        this.fontLoader.load(
            './Lato Light_Italic.json',
            (font) => {
                this.textParameters = {
                    font: font,
                    size: 16.0,
                    height: 6,
                    curveSegments: 2,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }

                this.textBackWallGeometry2 = new THREE.TextGeometry(
                    '@nate_dev_', 
                    this.textParameters
                )
                this.textBackWallGeometry2.scale(0.75, 0.75, 0.75)
                this.textBackWallGeometry2.computeBoundingBox()
                this.textBackWallGeometry2.center()
                this.textBackWall2 = new THREE.Mesh(this.textBackWallGeometry2, new THREE.MeshStandardMaterial({color: 0x00f5d4}))
                this.scene.add(this.textBackWall2)
                this.textBackWall2.position.set(0, 20, -152)
                //this.textBackWall.rotation.x = -Math.PI
                this.textBackWall2.castShadow = true
            }
        )
    }

    InitWelcomeText(){
        this.fontLoader = new THREE.FontLoader()
        this.welcomeTextOne = 'WELCOME'
        this.welcomeTextTwo = 'TOTHE'
        this.welcomeTextThree = 'MAZE'
        this.fontLoader.load(
            './EricaOne.json',
            (font) => {
                this.textParameters = {
                    font: font,
                    size: 4.0,
                    height: 3,
                    curveSegments: 12,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }
                this.textParameters2 = {
                    font: font,
                    size: 6.0,
                    height: 3,
                    curveSegments: 12,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }

                this.textParameters3 = {
                    font: font,
                    size: 9.0,
                    height: 3,
                    curveSegments: 12,
                    bevelEnabled: true,
                    bevelThickness: 0.03,
                    bevelSize: 0.02,
                    bevelOffset: 0,
                    bevelSegments: 5
                }
            
                for (let i = 0; i <= this.welcomeTextOne.length -1; i++){
                    this.welcomeTextGeometry = new THREE.TextGeometry(
                        this.welcomeTextOne[i],
                        this.textParameters
                    )
                    this.welcomeTextMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    this.welcomeText1 = new THREE.Mesh(this.welcomeTextGeometry, this.welcomeTextMaterial)
                    this.scene.add(this.welcomeText1)
                    this.welcomeText1.castShadow = true
                    this.welcomeTextGeometry.computeBoundingBox()
                    this.welcomeTextGeometry.center()
                    this.welcomeText1.position.set(0, -0.1, 0)

                    this.welcomeBoxShape = new CANNON.Box(new CANNON.Vec3(2.0, 2.0, 2.0))
                    this.welcomeBox = new CANNON.Body({
                    mass: 0.5, 
                    position: new CANNON.Vec3((i * 4) - 12, 18, 415),
                    shape: this.welcomeBoxShape,
                    material: this.ContactMaterial
                    })
                    this.world.addBody(this.welcomeBox)
                    this.objectsToUpdate.push({
                    mesh: this.welcomeText1,
                    body: this.welcomeBox
                    }) 
                }

                for (let i = 0; i <= this.welcomeTextTwo.length -1; i++){
                    this.welcomeTextGeometry = new THREE.TextGeometry(
                        this.welcomeTextTwo[i],
                        this.textParameters2
                    )
                    this.welcomeTextMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    this.welcomeText1 = new THREE.Mesh(this.welcomeTextGeometry, this.welcomeTextMaterial)
                    this.scene.add(this.welcomeText1)
                    this.welcomeText1.castShadow = true
                    this.welcomeTextGeometry.computeBoundingBox()
                    this.welcomeTextGeometry.center()
                    this.welcomeText1.position.set(0, -0.1, 0)

                    this.welcomeBoxShape = new CANNON.Box(new CANNON.Vec3(3.0, 3.0, 2.0))
                    this.welcomeBox = new CANNON.Body({
                    mass: 0.5, 
                    position: new CANNON.Vec3((i * 6.5) - 12, 12, 415),
                    shape: this.welcomeBoxShape,
                    material: this.ContactMaterial
                    })
                    this.world.addBody(this.welcomeBox)
                    this.objectsToUpdate.push({
                    mesh: this.welcomeText1,
                    body: this.welcomeBox
                    }) 
                }

                for (let i = 0; i <= this.welcomeTextThree.length -1; i++){
                    this.welcomeTextGeometry = new THREE.TextGeometry(
                        this.welcomeTextThree[i],
                        this.textParameters3
                    )
                    this.welcomeTextMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
                    this.welcomeText1 = new THREE.Mesh(this.welcomeTextGeometry, this.welcomeTextMaterial)
                    this.scene.add(this.welcomeText1)
                    this.welcomeText1.castShadow = true
                    this.welcomeTextGeometry.computeBoundingBox()
                    this.welcomeTextGeometry.center()
                    this.welcomeText1.position.set(0, -0.1, 0)

                    this.welcomeBoxShape = new CANNON.Box(new CANNON.Vec3(4.5, 4.5, 2.0))
                    this.welcomeBox = new CANNON.Body({
                    mass: 0.5, 
                    position: new CANNON.Vec3((i * 9) - 12, 5, 415),
                    shape: this.welcomeBoxShape,
                    material: this.ContactMaterial
                    })
                    this.world.addBody(this.welcomeBox)
                    this.objectsToUpdate.push({
                    mesh: this.welcomeText1,
                    body: this.welcomeBox
                    }) 
                }
            }
        )
    }

    InitLights(){
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1)
        this.scene.add(this.ambientLight)
        this.pointLight = new THREE.PointLight(0xffffff, 0.8)
        this.scene.add(this.pointLight)
        //this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.1)
        //this.scene.add(this.directionalLight)
        //this.directionalLight.position.set(0, 500, 500)
        this.pointLight.position.set(0, 150, 0)
        this.pointLight.castShadow = false
        //this.pointLight.shadow.mapSize.width = 512;
        //this.pointLight.shadow.mapSize.height = 512;
        this.headLight = new THREE.PointLight(0xffffff, 1.5,30, 1)
        this.headLight2 = new THREE.PointLight(0xffffff, 1.5,30, 1)
        this.headLightHelper = new THREE.PointLightHelper(this.headLight, 0xff00ff, 0.3)
        //this.group.add(this.headLightHelper)
        this.headLight.position.set(-1.5, 0.5,-10)
        this.headLight2.position.set(1.5, 0.5,-10)
        this.rectAreaLight = new THREE.RectAreaLight(0xffffff, 5.0, 80, 25)
        this.scene.add(this.rectAreaLight)
        this.rectAreaLight.position.set(0, 0, 25)

        this.rectAreaLight2 = new THREE.RectAreaLight(0xffffff, 5.0, 80, 25)
        this.scene.add(this.rectAreaLight2)
        this.rectAreaLight2.position.set(0, 0, -152)
        this.rectAreaLight2.rotation.x = Math.PI * 0.5
        
        this.group.add(this.headLight)
        this.group.add(this.headLight2)
        this.headLight.rotation.x = Math.PI * 0.5
    }

    InitControls(){
        this.controls = new OrbitControls(this.camera, canvas)
        this.controls.enableDamping = true
        //this.controls.enablePan = true
        //this.controls.update()
    }

    Resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(window.innerWidth, window.innerHeight)
    }

    Update(){
        requestAnimationFrame(() => {
            //this.stats.begin()     
            this.elapsedTime = this.clock.getElapsedTime()
            this.deltaTime = this.elapsedTime - this.oldElapsedTime
            this.oldElapsedTime = this.elapsedTime
            this.world.step(1/60, this.oldElapsedTime, 3)

            this.camera.lookAt(this.group.position)

            this.chaseCamPivot.getWorldPosition(this.v)
            if (this.v.y < 1){
                this.v.y = 1
            }
            this.camera.position.lerpVectors(this.camera.position, this.v, 0.1)
            for(this.object of this.objectsToUpdate){
                this.object.mesh.position.copy(this.object.body.position)
                this.object.mesh.quaternion.copy(this.object.body.quaternion)
            }

            for(this.object of this.pumpkinsToUpdate){
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

            if (this.clickMap['5'] || this.pressMap['5']){
                if (this.currentCam === this.birdeyeView){
                    this.chaseCamPivot.position.copy(this.closeupView)
                    this.currentCam = this.closeupView
                    this.clickMap = {}
                    this.pressMap = {}
                } else {
                    this.chaseCamPivot.position.copy(this.birdeyeView)
                    this.currentCam = this.birdeyeView
                    this.clickMap = {}
                    this.pressMap = {}
                }
            }

            this.firefliesMaterial.uniforms.u_time.value += this.clock.getDelta()
            
            this.renderer.render(this.scene, this.camera)
            //this.controls.update()
            //console.log(this.pumpkinBody.sleepState)
            //this.stats.end()
            this.Update()
        })  
    }
}

let _APP = null

window.addEventListener('DOMContentLoaded', () => {
    _APP = new NewScene()
})
