<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    spar  <SparNatural /> natural
   <HelloWorld msg="Welcome to Your Vue.js App"/> 
  </div>
</template>

<script>
// @ is an alias to /src
import HelloWorld from '@/components/HelloWorld.vue'
import SparNatural from 'sparnatural'

export default {
  name: 'HomeView',
  components: {
    HelloWorld,
    SparNatural
  }
}
</script>
