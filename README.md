# Relic-UI
Vue3-components-composables



# Toast
How to use? <Toast />
```base

function sendMessage() {
  showToast('I love u', 'success');
}
```
or
```base
 if (!love) {
      Message.value = 'fuck!fuck!fuck!';
      showToast(Message.value, 'warning');
      return;
    }
```

How to use the toggleToast?
```base
<div @click="toggleToast"></div>

<script setup lang="love">
const loveSelect=ref(true)

function byeMyLove {
 this.loveSelect.value = !loveSelect.value
}

 </script>
```




# ok
Wait for me to update
