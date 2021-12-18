import './style.css'
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { GUI } from 'dat.gui'
import Stats from 'stats.js'
import * as CANNON from 'cannon-es'
import cannonDebugger from 'cannon-es-debugger'
const canvas = document.querySelector('.webgl')

class NewScene{
    constructor(){
        this._Init()
    }
    
    _Init(){
        this.scene = new THREE.Scene()
        this.clock = new THREE.Clock()
        this.oldElapsedTime = 0
        this.v = new THREE.Vector3()
        this.gltfLoader = new GLTFLoader()
        this.objectsToUpdate = []
        this.keyMap = {}
        this.keyMapForward = {}
        this.keyMapUp = {}
        this.keyMapTurn = {}
        this.hoverMap = {}
        this.hoverTouch = {}
        this.climbing = false
        this.banking = false
        this.pitching = false
        this.yawing = false
        this.logEvents = false
        this.tpCache = new Array()
        this.stableLift = 14.7
        this.thrust = new CANNON.Vec3(0, 5, 0)
        
        this.InitStats()
        this.HeliGLTF()
        this.BuildingsGLTF()
        this.InitPhysics()
        this.InitPhysicsDebugger()
        this.InitEnv()
        //this.InitBuildings()
        this.InitHeliControls()
        this.InitCamera()
        this.InitLights()
        this.InitRenderer()
        this.InitControls()
        this.Update()
        window.addEventListener('resize', () => {
            this.Resize()
        })
        document.addEventListener('keydown', this.onDocumentKeyUp, false)
        document.addEventListener('keyup', this.onDocumentKeyUp, false)
        document.addEventListener('keydown', this.onDocumentKeyForward, false)
        document.addEventListener('keyup', this.onDocumentKeyForward, false)
        document.addEventListener('keydown', this.onDocumentKeyTurn, false)
        document.addEventListener('keyup', this.onDocumentKeyTurn, false)
        document.addEventListener('mouseover', this.onDocumentHover, false)
        document.addEventListener('mouseout', this.onDocumentHover, false)
        document.addEventListener('touchstart', this.onDocumentTouch, {passive: false} )
        document.addEventListener('touchend', this.onDocumentTouch, {passive: false}, false)
    }

    InitStats(){
        this.stats = new Stats()
        document.body.appendChild(this.stats.dom)
    }

    InitPhysics(){
        this.world = new CANNON.World()
        this.world.gravity.set(0, -9.82, 0)
        this.defaultMaterial = new CANNON.Material('default')
        this.defaultContactMaterial = new CANNON.ContactMaterial(
            this.defaultMaterial,
            this.defaultMaterial,
            {
                friction: 0,
                restitution: 0
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
                color: 0x00ffff,
                autoUpdate: true
            }
        )
    }

    InitEnv(){
        this.planeGeomtery = new THREE.PlaneGeometry(10000, 10000)
        this.planeMaterial = new THREE.MeshStandardMaterial({
            color: 0x144552,
            side: THREE.DoubleSide
        })
        this.plane = new THREE.Mesh(this.planeGeomtery, this.planeMaterial)
        this.plane.rotation.x = -Math.PI * 0.5
        this.scene.add(this.plane)

        this.fog = new THREE.FogExp2(0xffffff, 0.0025)
        this.scene.fog = this.fog

        this.groundBody = new CANNON.Body({
            mass: 0,
            material: this.defaultMaterial
        })
        this.world.addBody(this.groundBody)
        this.groundBody.addShape(new CANNON.Plane())
        this.groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)

        this.ceiling = new CANNON.Body({
            mass: 0,
            material: this.defaultMaterial
        })
        this.world.addBody(this.ceiling)
        this.ceiling.addShape(new CANNON.Box(new CANNON.Vec3(15000, 2, 15000)))
        //this.ceiling.quaternion.setFromAxisAngle(new CANNON.Vec3(-1, 0, 0), Math.PI * 0.5)
        this.ceiling.position.set(0, 250, 0)
    }

    // InitBuildings(){
    //     this.buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x191919})
    //     for (let i = 0; i <= 250; i++){
    //         this.rand = 250 + Math.random() * 250;
    //         this.x = Math.round(Math.random()*100+100)
    //         this.z = Math.round(Math.random()*100+100)
    //         this.angle = Math.random() * Math.PI * 200
    //         this.radius = 500 + Math.random() * 5000
    //         this.posX = Math.cos(this.angle) * this.radius
    //         this.posZ = Math.sin(this.angle) * this.radius
    //         this.building = new THREE.Mesh(new THREE.BoxGeometry(this.x, this.rand, this.z), this.buildingMaterial)
    //         this.scene.add(this.building)
    //         this.building.position.set(this.posX, this.rand/2, this.posZ)
        
    //         this.buildingShape = new CANNON.Box(new CANNON.Vec3(this.x/2, this.rand/2, this.z/2))
    //         this.buildingBody = new CANNON.Body({
    //             mass: 0,
    //             material: this.defaultMaterial
    //         })
    //         this.buildingBody.position.set(this.posX, this.rand/2, this.posZ)
    //         this.buildingBody.addShape(this.buildingShape)
    //         this.world.addBody(this.buildingBody)
    //     }
    // }

    BuildingsGLTF(){
        this.buildingMaterial = new THREE.MeshStandardMaterial()
        this.gltfLoader.load(
            'buildings.glb', (gltf) => {
                this.scene.add(gltf.scene)
            }
        )
    }

    HeliGLTF(){
       
       this.meshMaterial = new THREE.MeshStandardMaterial({color: 0xffff00})
        this.gltfLoader.load(
            'heli2.glb', (gltf) => {
                gltf.scene.traverse((child) => {
                    child.material = this.meshMaterial
                    if(child.name === 'MainRotor'){
                        this.rotorMesh = child
                        
                    }
                    if(child.name === 'heli'){
                        this.heliMesh = child
                        // this.heliMesh.rotation.y = -Math.PI * 0.5
                        this.heliMesh.add(this.chaseCam)
                    }
                })
                this.scene.add(gltf.scene)
                //console.log(gltf)
                this.helicopterBody = new CANNON.Body({
                    mass: 0.0125,
                    material: this.defaultMaterial
                })
                this.helicopterShape = new CANNON.Box(new CANNON.Vec3(3., 1.5, 2.0))
                this.helicopterBody.addShape(this.helicopterShape)
                if(this.heliMesh){
                    this.helicopterBody.position.copy(this.heliMesh.position)
                }
                this.helicopterBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, -1, 0), Math.PI * 0.5)
                this.helicopterBody.angularDamping = 0.9
                this.world.addBody(this.helicopterBody)

                this.helicopterBody.addShape(new CANNON.Box(new CANNON.Vec3(3.0, 0.5, 2.5)), new CANNON.Vec3(0, -1.6, 0))
                //this.helicopterBody.addShape(new CANNON.Sphere(0.5), new CANNON.Vec3(0.0, 0.25, 0.0))
                
                if(this.heliMesh){
                    //console.log(this.heliMesh)
                    this.objectsToUpdate.push({
                        mesh: this.heliMesh,
                        body: this.helicopterBody
                    })
                }

                this.rotorShape = new CANNON.Sphere(0.1)
                this.rotorBody = new CANNON.Body({
                    mass: 0.12,
                    material: this.defaultMaterial
                })
                this.rotorBody.addShape(this.rotorShape)
                this.rotorBody.position.x = this.rotorMesh.position.x
                this.rotorBody.position.y = this.rotorMesh.position.y
                this.rotorBody.position.z = this.rotorMesh.position.z

                this.rotorBody.linearDamping = 0.5
                this.world.addBody(this.rotorBody)

                this.rotorConstraint = new CANNON.PointToPointConstraint(
                    this.helicopterBody,
                    new CANNON.Vec3(0, 0.001, 0),
                    this.rotorBody,
                    new CANNON.Vec3(0, 0, 0)
                )

                this.rotorConstraint.collideConnected = false
                this.world.addConstraint(this.rotorConstraint)

                this.objectsToUpdate.push({
                    mesh: this.rotorMesh,
                    body: this.rotorBody
                }) 
            }
        ) 
    }

    InitHeliControls(){
        this.onDocumentKey = (e) => {
            this.keyMap[e.key] = 'keydown'
        }
        this.onDocumentKeyUp = (e) => {
            e.preventDefault()
            this.keyMapUp[e.key] = 'keydown'
        }
        this.onDocumentKeyForward = (e) => {
            this.keyMapForward[e.key] = 'keydown'
        }
        this.onDocumentKeyTurn = (e) => {
            this.keyMapTurn[e.key] = 'keydown'
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

    InitLights(){
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
        this.scene.add(this.ambientLight)
        this.pointLight = new THREE.PointLight(0xffffff, 2.0, 5000)
        this.pointLight.position.set(0, 500, 0)
        this.scene.add(this.pointLight)
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
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 100000)
        this.camera.position.set(0, 500, 250)
        this.scene.add(this.camera)
        this.chaseCam = new THREE.Object3D()
        this.chaseCam.position.set(0, 0, 0)
        this.chaseCamPivot = new THREE.Object3D()
        this.chaseCamPivot.position.set(-75, 40, 0)
        this.chaseCam.add(this.chaseCamPivot)
        this.scene.add(this.chaseCam)
    }

    InitControls(){
        this.controls = new OrbitControls(this.camera, canvas)
        this.controls.enableDamping = true
        this.controls.enablePan = true
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
            this.delta = this.clock.getDelta()
            this.world.step(1/60, this.oldElapsedTime, 3)
            if(this.rotorMesh && this.heliMesh){

            for(this.object of this.objectsToUpdate){
                this.object.mesh.position.copy(this.object.body.position)
                this.object.mesh.quaternion.copy(this.object.body.quaternion)
            }

            this.rotorMesh.rotateY(this.elapsedTime * this.thrust.y * 50)
            this.rotorMesh.position.copy(this.rotorBody.position)
            
            this.climbing = false
            if (this.keyMapUp['e'] || this.hoverTouch['5'] || this.hoverMap['5']){
                if(this.thrust.y < 40){
                    this.thrust.y += 5 * this.deltaTime
                    this.climbing = true
                }
                this.keyMapUp = {}
            }
            if(this.keyMapUp['q'] || this.hoverTouch['6'] || this.hoverMap['6']){
                if(this.thrust.y > 3){
                    this.thrust.y -= 5 * this.deltaTime 
                    //this.thrust.y = 3
                    this.climbing = true
                }
                this.keyMapUp = {}
            }

            this.yawing = false
            this.banking = false
            if (this.keyMapTurn['a'] || this.hoverTouch['1'] || this.hoverMap['1']){
                if(this.rotorBody.angularVelocity.y < 2.0){
                    this.rotorBody.angularVelocity.y += 0.85 * this.deltaTime 
                    this.yawing = true
                if(this.thrust.x >= 2.5){
                    this.thrust.x -= 1.25 * this.deltaTime /1.5
                    }
                    this.banking = true
                }
                this.keyMapTurn = {}
            }
            
            if (this.keyMapTurn['d'] || this.hoverTouch['2'] || this.hoverMap['2']){
                if(this.rotorBody.angularVelocity.y > -2.0){
                    this.rotorBody.angularVelocity.y -= 0.85 * this.deltaTime 
                    this.yawing = true
                }
                if(this.thrust.x <= -2.5){
                    this.thrust.x += 1.25 * this.deltaTime / 1.5
                }
                this.banking = true
                this.keyMapTurn = {}
            }

            this.pitching = false
            if(this.keyMapForward['s'] || this.hoverTouch['4'] || this.hoverMap['4']){
                if(this.thrust.z >= 0.0){
                    this.thrust.z -= 15.0 * this.deltaTime
                    this.pitching = true     
                }
                this.keyMapForward = {}
            }
            if(this.keyMapForward['w'] || this.hoverTouch['3'] || this.hoverMap['3']){
                if(this.thrust.z <= 25.0 && this.heliMesh.position.y > 5){
                    this.thrust.z += 5.0 * this.deltaTime * 1.25
                    this.pitching = true     
                }
                this.keyMapForward = {}
            }

            if(!this.yawing){
                if(this.rotorBody.angularVelocity.y < 0){
                    this.rotorBody.angularVelocity.y += 0.5 * this.deltaTime
                }
                if(this.rotorBody.angularVelocity.y > 0){
                    this.rotorBody.angularVelocity.y -= 0.5 * this.deltaTime
                }
            }

            this.helicopterBody.angularVelocity.y = this.rotorBody.angularVelocity.y

            if(!this.pitching){
                if(this.thrust.z < 0){
                    this.thrust.z += 2.5 * this.deltaTime
                }
                if(this.thrust.z > 0){
                    this.thrust.z -= 2.5 * this.deltaTime
                }
            }

            if(!this.banking){
                if(this.thrust.x < 0){
                    this.thrust.x += 5.5 * this.deltaTime
                }
                if(this.thrust.x > 0){
                    this.thrust.x -= 5.5 * this.deltaTime
                }
            }

            // if(this.climbing == false){
            //      this.thrust.y = 4.5
            // }

            this.rotorBody.applyLocalForce(this.thrust, new CANNON.Vec3())  
        }
            if(this.heliMesh){
                this.camera.lookAt(this.heliMesh.position)
            }
            this.chaseCamPivot.getWorldPosition(this.v)
            if(this.v.y < 1){
                this.v.y = 1
            }
        
            this.camera.position.lerpVectors(this.camera.position, this.v, 0.5)
            
            this.renderer.render(this.scene, this.camera)
            this.controls.update()
            this.Update()
            this.stats.update()
        })  
    }
}

let _APP = null

window.addEventListener('DOMContentLoaded', () => {
    _APP = new NewScene()
})
