import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function Index () {
  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className='index'>
      <Text className='title'>ChainPass</Text>
      <Text className='subtitle'>WeChat Mini Program</Text>
      <Text>Experimental platform scaffold. Ticketing features are not connected.</Text>
    </View>
  )
}
