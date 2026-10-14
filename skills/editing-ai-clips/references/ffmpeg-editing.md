# FFmpeg编码与验证参考

适用于已有FFmpeg且允许本地输出预览的环境。通过参数数组调用，不把用户路径拼成 shell 命令。Windows中文路径优先交给 Python `subprocess.run([...], check=True)`；不要使用未引用的字符串拼接。检测可用工具后再执行，不默认安装新软件。

## 1. 先确定真实长度

有ffprobe时读取流和帧的时间戳；没有ffprobe可用FFmpeg读取头信息并完整解码。容器里最后的音频填充不等于有效剧情长度。

选定时间线FPS之后，把确认过的剪辑区间换成整数帧：`duration = kept_frames / fps`。CFR处理会按时间戳取舍或复制帧，不能把它说成生成了新的动作细节。输出尺寸按原素材与用户需求确定，不用放大冒充高清。

## 2. 一个三段片的滤镜例子

以下仅展示**已经确认保留5、15、15秒，统一24fps、同为1280×720且都有音轨**的情形。数值不是所有视频的默认值。每次先测量并改成当前素材的切点和增益。

下面滤镜可作为 `-filter_complex` 的值，配合按顺序传入的三个 `-i` 输入，以及 `-map [v] -map [a]`。若命令行需运行，先将换行合并为空格，避免shell把换行误作多条命令。

```text
[0:v]fps=24,trim=duration=5,setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v0];
[1:v]fps=24,trim=duration=15,setpts=PTS-STARTPTS,setsar=1,format=yuv420p,
fade=t=out:st=14.875:d=0.125:color=0xF9E9CA[v1];
[2:v]fps=24,trim=duration=15,setpts=PTS-STARTPTS,setsar=1,format=yuv420p,
fade=t=in:st=0:d=0.166666667:color=0xF9E9CA[v2];
[0:a]atrim=duration=5,asetpts=PTS-STARTPTS,aresample=48000,volume=6.19dB,
afade=t=in:d=0.04,afade=t=out:st=4.94:d=0.06,apad,atrim=duration=5[a0];
[1:a]atrim=duration=15,asetpts=PTS-STARTPTS,aresample=48000,volume=-1.01dB,
afade=t=in:d=0.06,afade=t=out:st=14.84:d=0.16,apad,atrim=duration=15[a1];
[2:a]atrim=duration=15,asetpts=PTS-STARTPTS,aresample=48000,volume=-0.91dB,
afade=t=in:d=0.16,afade=t=out:st=14.975:d=0.025,apad,atrim=duration=15[a2];
[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]
```

这个例子用末尾3帧和下一段开头4帧的暖光连接已有爆光。没有该画面依据时，移除两段video fade，采用实际选定的转场。`apad`只在明确需要对齐的尾端补静音，不替代审听；长音频缺口应先排查而不是自动填满。

推荐浏览器交付参数示例：`-c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -b:a 192k -ar 48000 -ac 2 -movflags +faststart`。不要使用流复制拼接格式或时间基不一致的片段，也不要认为带音轨的多段MP4流复制能自动消除AAC填充间隙。

素材没有音轨时按实际情况设计静音或另外配音，不能引用不存在的`[i:a]`。不再需要逐段调整时可一次编码成片；若先输出三段处理素材用于可编辑草稿，再合成预览，应记录转场与音量已烘焙，并避免反复压缩。

## 3. 声音测量与成片检查

- 输入测量示例：`-af loudnorm=I=-20:TP=-1.5:LRA=20:print_format=json -vn -f null -`。这是分析运行，输出JSON在stderr，不等于已把源文件改到目标响度。
- 常量增益示例：`gain_db = min(target_lufs - input_i, peak_limit - input_tp)`；若动态范围不适合统一目标，则保留合理差异。编码后真峰值可能变化，重新测量并据结果调整。
- 完整解码：`ffmpeg -v error -i output.mp4 -f null -`。退出码、stderr与实际流参数共同检查。
- 查黑场：`-vf blackdetect=d=0.04:pix_th=0.04`。输出时间段要与设计过的转场对应，不把正常黑背景自动判错。
- 检查两段接缝附近的连续帧、终帧和声音；只抽一张缩略图或看到编码退出0不足以证明自然连贯。
- 明确区分：完整解码通过、接缝画面检查通过、浏览器播放通过、音频人工试听通过、剪映打开/播放/导出通过。只报告已完成的项目。
